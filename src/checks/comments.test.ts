import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { gitDiffAgainstBase } from '../shared/git.ts'
import { runComments } from './comments.ts'

// context: the diff-scoped gates (narration/density/block-new) read git; mocking the diff keeps these tests
// hermetic and lets each case craft the exact changed lines it needs.
vi.mock('../shared/git.ts', () => ({ gitDiffAgainstBase: vi.fn(() => '') }))
const mockDiff = (diff: string): void => {
  vi.mocked(gitDiffAgainstBase).mockReturnValue(diff)
}

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'verify-comments-')))
  mockDiff('')
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

/** A unified diff that marks every line of `content` as freshly added in `file`. */
function diffFor(file: string, content: string): string {
  const lines = content.split('\n')
  const body = lines.map((l) => `+${l}`).join('\n')
  return `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${body}\n`
}

describe('runComments — comment blocks (scope: all)', () => {
  it('passes and is named `comments` when no block exceeds max-lines', () => {
    const file = write('ok.ts', ['// one line', 'const a = 1'].join('\n'))
    expect(runComments({ pattern: file, maxLines: 2, scope: 'all' })).toEqual({ name: 'comments', ok: true })
  })

  it('fails on a comment block longer than max-lines', () => {
    const file = write('bad.ts', ['// one', '// two', '// three', 'const a = 1'].join('\n'))
    expect(runComments({ pattern: file, maxLines: 2, scope: 'all' })).toEqual({ name: 'comments', ok: false })
  })

  it('reports without failing under warn', () => {
    const file = write('warn.ts', ['// one', '// two', '// three', 'const a = 1'].join('\n'))
    expect(runComments({ pattern: file, maxLines: 2, warn: true, scope: 'all' }).ok).toBe(true)
  })

  it('leaves JSDoc and context: blocks alone regardless of length', () => {
    const file = write('exempt.ts', ['/**', ' * a', ' * b', ' * c', ' */', '// context: durable', '// more', 'const a = 1'].join('\n'))
    expect(runComments({ pattern: file, maxLines: 1, scope: 'all' }).ok).toBe(true)
  })

  it('does not flag a whole-file block under the default diff scope with an empty diff', () => {
    const file = write('diffscope.ts', ['// one', '// two', '// three', 'const a = 1'].join('\n'))
    expect(runComments({ pattern: file, maxLines: 2 }).ok).toBe(true)
  })
})

describe('runComments — narration (default on)', () => {
  it('fails on a narration comment on a changed line', () => {
    const content = ['const a = 1', '// let me add the handler', 'const b = 2'].join('\n')
    const file = write('narr.ts', content)
    mockDiff(diffFor(file, content))
    expect(runComments({ pattern: file, maxLines: 2 }).ok).toBe(false)
  })

  it('passes when --no-narration disables it', () => {
    const content = ['const a = 1', '// let me add the handler', 'const b = 2'].join('\n')
    const file = write('narr2.ts', content)
    mockDiff(diffFor(file, content))
    expect(runComments({ pattern: file, maxLines: 2, narration: false, density: false }).ok).toBe(true)
  })
})

describe('runComments — density (default on)', () => {
  it('fails a comment-dense changed file', () => {
    const content = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? `// note ${i}` : `const v${i} = ${i}`)).join('\n')
    const file = write('dense.ts', content)
    mockDiff(diffFor(file, content))
    expect(runComments({ pattern: file, maxLines: 2, narration: false }).ok).toBe(false)
  })

  it('honours a disabled density threshold', () => {
    const content = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? `// note ${i}` : `const v${i} = ${i}`)).join('\n')
    const file = write('dense2.ts', content)
    mockDiff(diffFor(file, content))
    expect(runComments({ pattern: file, maxLines: 2, narration: false, density: false }).ok).toBe(true)
  })
})

describe('runComments — block-new-comments (opt-in)', () => {
  it('fails on any non-exempt comment on a changed line', () => {
    const content = ['const a = 1', '// a plain comment', 'const b = 2'].join('\n')
    const file = write('bn.ts', content)
    mockDiff(diffFor(file, content))
    expect(runComments({ pattern: file, maxLines: 2, blockNewComments: true }).ok).toBe(false)
  })

  it('passes when the diff has no comments', () => {
    const content = ['const a = 1', 'const b = 2'].join('\n')
    const file = write('bn2.ts', content)
    mockDiff(diffFor(file, content))
    expect(runComments({ pattern: file, maxLines: 2, blockNewComments: true }).ok).toBe(true)
  })
})
