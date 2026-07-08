import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { applyInit } from './init.ts'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-init-'))
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'scratch' }))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function readScripts(): Record<string, string> {
  return (JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')) as { scripts: Record<string, string> }).scripts
}

describe('applyInit', () => {
  it('writes verify:* scripts, agent files, and collects external devDeps', () => {
    const result = applyInit({ cwd: dir, checks: ['complexity', 'knip'], targets: ['claude'], defaultsOnly: false })

    const scripts = readScripts()
    expect(scripts['verify:complexity']).toBe('verifyx complexity')
    expect(scripts['verify:knip']).toContain('knip')
    expect(scripts.verify).toBe('verifyx')
    expect(result.devDeps).toContain('knip')
    expect(fs.existsSync(path.join(dir, '.claude', 'commands', 'verify.md'))).toBe(true)
    expect(fs.existsSync(path.join(dir, '.claude', 'skills', 'verify', 'SKILL.md'))).toBe(true)
  })

  it('defaults-only writes no verify:* scripts but keeps devDeps and agent files', () => {
    const result = applyInit({ cwd: dir, checks: ['knip'], targets: ['agents'], defaultsOnly: true })

    expect(Object.keys(readScripts())).toEqual(['verify'])
    expect(result.devDeps).toContain('knip')
    expect(fs.existsSync(path.join(dir, '.agent-skills', 'verify', 'SKILL.md'))).toBe(true)
  })

  it('does not clobber an existing verify:* script', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { 'verify:complexity': 'custom' } }))
    applyInit({ cwd: dir, checks: ['complexity'], targets: [], defaultsOnly: false })
    expect(readScripts()['verify:complexity']).toBe('custom')
  })
})
