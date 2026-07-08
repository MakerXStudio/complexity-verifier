import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { entryCheckName, resolveEntries, resolveOverride, selectEntries, type VerifyEntry } from './resolveEntries.ts'

function entry(name: string): VerifyEntry {
  return { name, command: `npm run ${name}`, cwd: '.' }
}

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-entries-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('resolveEntries', () => {
  it('collects only verify:* scripts as npm run entries', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { 'verify:a': 'x', build: 'y', 'verify:b': 'z' } }))
    const entries = resolveEntries(dir)
    expect(entries.map((e) => e.name).sort()).toEqual(['verify:a', 'verify:b'])
    expect(entries.find((e) => e.name === 'verify:a')?.command).toBe('npm run verify:a')
  })

  it('returns [] when there are no verify:* scripts', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { build: 'x' } }))
    expect(resolveEntries(dir)).toEqual([])
  })
})

describe('entryCheckName', () => {
  it('strips the verify: prefix', () => {
    expect(entryCheckName('verify:lint')).toBe('lint')
  })
  it('strips a trailing :fix so a variant maps to its base check', () => {
    expect(entryCheckName('verify:lint:fix')).toBe('lint')
    expect(entryCheckName('verify:comment-block:fix')).toBe('comment-block')
  })
})

describe('selectEntries (bare verifyx: verify:<name> / verify:<name>:fix pairs)', () => {
  it('runs the base script in both modes when there is no :fix variant', () => {
    const entries = [entry('verify:lint')]
    expect(selectEntries(entries, 'check').map((e) => e.name)).toEqual(['verify:lint'])
    expect(selectEntries(entries, 'fix').map((e) => e.name)).toEqual(['verify:lint'])
  })

  it('prefers the :fix variant in fix mode and the base in check mode', () => {
    const entries = [entry('verify:lint'), entry('verify:lint:fix')]
    expect(selectEntries(entries, 'fix').map((e) => e.name)).toEqual(['verify:lint:fix'])
    expect(selectEntries(entries, 'check').map((e) => e.name)).toEqual(['verify:lint'])
  })

  it('never runs both the base and the :fix variant of the same check', () => {
    const entries = [entry('verify:lint'), entry('verify:lint:fix')]
    expect(selectEntries(entries, 'fix')).toHaveLength(1)
    expect(selectEntries(entries, 'check')).toHaveLength(1)
  })

  it('uses a lone :fix variant in fix mode but skips it in check mode', () => {
    const entries = [entry('verify:lint:fix')]
    expect(selectEntries(entries, 'fix').map((e) => e.name)).toEqual(['verify:lint:fix'])
    expect(selectEntries(entries, 'check')).toEqual([])
  })

  it('keeps distinct checks independent', () => {
    const entries = [entry('verify:lint'), entry('verify:lint:fix'), entry('verify:complexity')]
    expect(
      selectEntries(entries, 'fix')
        .map((e) => e.name)
        .sort(),
    ).toEqual(['verify:complexity', 'verify:lint:fix'])
  })
})

describe('resolveOverride (verifyx all per-check override)', () => {
  const entries = [entry('verify:lint'), entry('verify:lint:fix'), entry('verify:complexity')]

  it('returns the :fix variant in fix mode, the base in check mode', () => {
    expect(resolveOverride(entries, 'lint', 'fix')?.name).toBe('verify:lint:fix')
    expect(resolveOverride(entries, 'lint', 'check')?.name).toBe('verify:lint')
  })

  it('falls back to the base when there is no :fix variant', () => {
    expect(resolveOverride(entries, 'complexity', 'fix')?.name).toBe('verify:complexity')
  })

  it('returns undefined when no override is defined (built-in is used)', () => {
    expect(resolveOverride(entries, 'knip', 'fix')).toBeUndefined()
    expect(resolveOverride([entry('verify:lint:fix')], 'lint', 'check')).toBeUndefined()
  })
})
