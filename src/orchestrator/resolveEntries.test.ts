import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveEntries } from './resolveEntries.ts'

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

  it('attaches diff filters from the verify config', () => {
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ scripts: { 'verify:web': 'x' }, verify: { filters: { 'verify:web': 'web/**' } } }),
    )
    expect(resolveEntries(dir).find((e) => e.name === 'verify:web')?.filter).toBe('web/**')
  })
})
