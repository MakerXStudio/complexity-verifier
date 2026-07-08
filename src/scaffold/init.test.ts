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
  it('writes verify:* scripts, the verify skill, a CLAUDE.md pointer, and collects external devDeps', () => {
    const result = applyInit({ cwd: dir, checks: ['complexity', 'unused-code'], targets: ['claude'], defaultsOnly: false })

    const scripts = readScripts()
    expect(scripts['verify:complexity']).toBe('verifyx complexity')
    expect(scripts['verify:unused-code']).toBe('verifyx unused-code')
    expect(scripts.verify).toBe('verifyx')
    expect(result.devDeps).toContain('knip')
    // The skill (not a slash command) is the Claude integration.
    expect(fs.existsSync(path.join(dir, '.claude', 'skills', 'verify', 'SKILL.md'))).toBe(true)
    expect(fs.existsSync(path.join(dir, '.claude', 'commands'))).toBe(false)
    // CLAUDE.md is created with the verify pointer.
    expect(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8')).toContain('npm run verify')
  })

  it('defaults-only writes no verify:* scripts, points verify at `verifyx all`, and writes the agents skill + AGENTS.md', () => {
    const result = applyInit({ cwd: dir, checks: ['unused-code'], targets: ['agents'], defaultsOnly: true })

    expect(Object.keys(readScripts())).toEqual(['verify'])
    expect(readScripts().verify).toBe('verifyx all')
    expect(result.devDeps).toContain('knip')
    expect(fs.existsSync(path.join(dir, '.agent-skills', 'verify', 'SKILL.md'))).toBe(true)
    expect(fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8')).toContain('npm run verify')
  })

  it('does not clobber an existing verify:* script', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { 'verify:complexity': 'custom' } }))
    applyInit({ cwd: dir, checks: ['complexity'], targets: [], defaultsOnly: false })
    expect(readScripts()['verify:complexity']).toBe('custom')
  })
})
