import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CHECKS } from '../checks/registry.ts'
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

  it('defaults-only with every check installs all external devDeps but writes only the verify script', () => {
    const result = applyInit({ cwd: dir, checks: CHECKS.map((c) => c.name), targets: [], defaultsOnly: true })

    expect(Object.keys(readScripts())).toEqual(['verify'])
    expect(readScripts().verify).toBe('verifyx all')
    // Every external check's tool is installed, so `verifyx all` can actually run them.
    expect(result.devDeps).toEqual(expect.arrayContaining(['knip', 'jscpd', 'skott']))
  })

  it('bakes the chosen comment scope/strictness into verify:comments', () => {
    applyInit({ cwd: dir, checks: ['comments'], targets: [], defaultsOnly: false, commentScope: 'all', commentBlockAll: true })
    expect(readScripts()['verify:comments']).toBe('verifyx comments --pushback --scope all --block-all')
  })

  it('defaults comment options to a plain pushback script', () => {
    applyInit({ cwd: dir, checks: ['comments'], targets: [], defaultsOnly: false })
    expect(readScripts()['verify:comments']).toBe('verifyx comments --pushback')
  })

  it('emits a verify:comments override under defaults-only only when a non-default comment option is chosen', () => {
    applyInit({ cwd: dir, checks: CHECKS.map((c) => c.name), targets: [], defaultsOnly: true, commentBlockAll: true })
    expect(readScripts()['verify:comments']).toBe('verifyx comments --pushback --block-all')
    expect(readScripts().verify).toBe('verifyx all')
  })

  it('does not clobber an existing verify:* script', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { 'verify:complexity': 'custom' } }))
    applyInit({ cwd: dir, checks: ['complexity'], targets: [], defaultsOnly: false })
    expect(readScripts()['verify:complexity']).toBe('custom')
  })

  it('teaches knip to ignore the external tools verifyx runs when unused-code is selected', () => {
    applyInit({ cwd: dir, checks: ['unused-code', 'lint', 'format'], targets: [], defaultsOnly: false })
    const knip = JSON.parse(fs.readFileSync(path.join(dir, 'knip.json'), 'utf-8')) as { ignoreDependencies?: string[] }
    expect(knip.ignoreDependencies).toEqual(expect.arrayContaining(['oxlint', 'oxfmt']))
    expect(knip.ignoreDependencies).not.toContain('knip') // the runner isn't flagged
  })

  it('does not create a knip config when unused-code is not selected', () => {
    applyInit({ cwd: dir, checks: ['lint', 'format'], targets: [], defaultsOnly: false })
    expect(fs.existsSync(path.join(dir, 'knip.json'))).toBe(false)
  })
})
