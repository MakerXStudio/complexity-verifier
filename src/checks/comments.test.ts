import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runComments } from './comments.ts'

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'verify-comments-')))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

// A forward-slashed path resolvePattern leaves untouched, so findSourceFiles matches the single file directly.
function write(name: string, content: string): string {
  const file = path.join(dir, name)
  fs.writeFileSync(file, content)
  return file.replaceAll('\\', '/')
}

describe('runComments', () => {
  it('passes and is named `comments` when no block exceeds max-lines', () => {
    const file = write('ok.ts', ['// one line', 'const a = 1'].join('\n'))
    expect(runComments({ pattern: file, maxLines: 2 })).toEqual({ name: 'comments', ok: true })
  })

  it('fails on a comment block longer than max-lines', () => {
    const file = write('bad.ts', ['// one', '// two', '// three', 'const a = 1'].join('\n'))
    expect(runComments({ pattern: file, maxLines: 2 })).toEqual({ name: 'comments', ok: false })
  })

  it('reports without failing under warn', () => {
    const file = write('warn.ts', ['// one', '// two', '// three', 'const a = 1'].join('\n'))
    expect(runComments({ pattern: file, maxLines: 2, warn: true }).ok).toBe(true)
  })

  it('leaves JSDoc and context: blocks alone regardless of length', () => {
    const file = write('exempt.ts', ['/**', ' * a', ' * b', ' * c', ' */', '// context: durable', '// more', 'const a = 1'].join('\n'))
    expect(runComments({ pattern: file, maxLines: 1 }).ok).toBe(true)
  })
})
