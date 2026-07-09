import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveClaudeDir } from './claudeDir.ts'

let dir: string
const mk = (...segs: string[]): string => {
  const p = path.join(dir, ...segs)
  fs.mkdirSync(p, { recursive: true })
  return p
}

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'verify-claudedir-')))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('resolveClaudeDir', () => {
  it('uses cwd when it already has a .claude', () => {
    const cwd = mk('pkg')
    mk('pkg', '.claude')
    expect(resolveClaudeDir(cwd)).toBe(cwd)
  })

  it('attaches to the nearest ancestor .claude within range', () => {
    const root = mk('root')
    mk('root', '.claude')
    const cwd = mk('root', 'a', 'b')
    expect(resolveClaudeDir(cwd)).toBe(root)
  })

  it('creates at cwd when no .claude is nearby', () => {
    const cwd = mk('lonely')
    expect(resolveClaudeDir(cwd)).toBe(cwd)
  })

  it('does not climb past the git root to an ancestor .claude', () => {
    mk('.claude') // above the repo
    mk('repo', '.git')
    const cwd = mk('repo', 'pkg')
    expect(resolveClaudeDir(cwd)).toBe(cwd)
  })

  it('honours an explicit override (resolved against cwd)', () => {
    const cwd = mk('pkg')
    expect(resolveClaudeDir(cwd, '../elsewhere')).toBe(path.resolve(cwd, '../elsewhere'))
  })
})
