import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { findLongCommentBlocks } from './comments.ts'

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cv-comments-')))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function write(content: string): string {
  const file = path.join(dir, 'sample.ts')
  fs.writeFileSync(file, content)
  return file
}

function violations(content: string, maxLines: number) {
  return findLongCommentBlocks([write(content)], maxLines)
}

describe('findLongCommentBlocks', () => {
  it('flags a // run longer than the max', () => {
    const found = violations(['// one', '// two', '// three', 'const a = 1'].join('\n'), 2)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ line: 1, lines: 3 })
  })

  it('does not flag a // run at the max', () => {
    expect(violations(['// one', '// two', 'const a = 1'].join('\n'), 2)).toEqual([])
  })

  it('allows a long JSDoc block of any length', () => {
    const src = ['/**', ' * line', ' * line', ' * line', ' * line', ' */', 'const a = 1'].join('\n')
    expect(violations(src, 2)).toEqual([])
  })

  it('flags a long non-JSDoc block comment', () => {
    const src = ['/*', ' line', ' line', ' line', '*/', 'const a = 1'].join('\n')
    const found = violations(src, 2)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ line: 1, lines: 5 })
  })

  it('exempts a // block whose first line starts with context:', () => {
    const src = ['// context: why this exists', '// more detail', '// even more', 'const a = 1'].join('\n')
    expect(violations(src, 2)).toEqual([])
  })

  it('exempts a block comment starting with context: (case-insensitive)', () => {
    const src = ['/* Context: durable reasoning', ' spanning lines', ' and more', '*/', 'const a = 1'].join('\n')
    expect(violations(src, 2)).toEqual([])
  })

  it('ignores trailing/inline comments', () => {
    const src = ['const a = 1 // one', 'const b = 2 // two', 'const c = 3 // three'].join('\n')
    expect(violations(src, 2)).toEqual([])
  })

  it('treats a blank line as breaking a // run', () => {
    const src = ['// one', '// two', '', '// three', '// four'].join('\n')
    expect(violations(src, 2)).toEqual([])
  })
})
