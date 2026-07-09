import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ensureKnipIgnores } from './knipConfig.ts'
import type { ManagedFileResult } from './writeManaged.ts'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-knip-'))
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'scratch' }))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const readKnip = () => JSON.parse(fs.readFileSync(path.join(dir, 'knip.json'), 'utf-8')) as { ignoreDependencies?: string[] }

describe('ensureKnipIgnores', () => {
  it('does nothing when there are no deps to ignore', () => {
    const results: ManagedFileResult[] = []
    ensureKnipIgnores(dir, [], results)
    expect(results).toEqual([])
    expect(fs.existsSync(path.join(dir, 'knip.json'))).toBe(false)
  })

  it('creates a minimal knip.json when there is no config', () => {
    const results: ManagedFileResult[] = []
    ensureKnipIgnores(dir, ['oxlint', 'oxfmt'], results)
    expect(results[0]?.action).toBe('created')
    expect(readKnip().ignoreDependencies).toEqual(['oxlint', 'oxfmt'])
  })

  it('merges missing deps into an existing knip.json without touching other content', () => {
    fs.writeFileSync(path.join(dir, 'knip.json'), JSON.stringify({ entry: ['src/x.ts'], ignoreDependencies: ['oxlint'] }, null, 2))
    const results: ManagedFileResult[] = []
    ensureKnipIgnores(dir, ['oxlint', 'jscpd'], results)
    expect(results[0]?.action).toBe('updated')
    const cfg = readKnip() as { entry?: string[]; ignoreDependencies?: string[] }
    expect(cfg.ignoreDependencies).toEqual(['oxlint', 'jscpd']) // oxlint not duplicated
    expect(cfg.entry).toEqual(['src/x.ts']) // untouched
  })

  it('is unchanged when every dep is already ignored', () => {
    fs.writeFileSync(path.join(dir, 'knip.json'), JSON.stringify({ ignoreDependencies: ['oxlint', 'oxfmt'] }))
    const results: ManagedFileResult[] = []
    ensureKnipIgnores(dir, ['oxlint'], results)
    expect(results[0]?.action).toBe('unchanged')
  })

  it('merges into package.json#knip when present and there is no knip.json', () => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'scratch', knip: { ignoreDependencies: ['skott'] } }, null, 2))
    const results: ManagedFileResult[] = []
    ensureKnipIgnores(dir, ['oxlint'], results)
    expect(results[0]?.path).toContain('package.json')
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8')) as { knip: { ignoreDependencies: string[] } }
    expect(pkg.knip.ignoreDependencies).toEqual(['skott', 'oxlint'])
    expect(fs.existsSync(path.join(dir, 'knip.json'))).toBe(false)
  })

  it('leaves a code-based knip config untouched', () => {
    fs.writeFileSync(path.join(dir, 'knip.ts'), 'export default {}\n')
    const results: ManagedFileResult[] = []
    ensureKnipIgnores(dir, ['oxlint'], results)
    expect(results).toEqual([])
    expect(fs.existsSync(path.join(dir, 'knip.json'))).toBe(false)
  })
})
