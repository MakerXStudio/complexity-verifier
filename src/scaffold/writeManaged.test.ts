import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type ManagedFileResult, summarise, writeManaged } from './writeManaged.ts'

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-managed-'))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('writeManaged', () => {
  it('creates a file (and parent dirs), then reports unchanged, then updated', () => {
    const file = path.join(dir, 'nested', 'file.md')

    const created: ManagedFileResult[] = []
    writeManaged(file, 'a', created)
    expect(created[0]?.action).toBe('created')
    expect(fs.readFileSync(file, 'utf-8')).toBe('a')

    const unchanged: ManagedFileResult[] = []
    writeManaged(file, 'a', unchanged)
    expect(unchanged[0]?.action).toBe('unchanged')

    const updated: ManagedFileResult[] = []
    writeManaged(file, 'b', updated)
    expect(updated[0]?.action).toBe('updated')
    expect(fs.readFileSync(file, 'utf-8')).toBe('b')
  })

  it('refuses to write through a symlink', () => {
    const target = path.join(dir, 'target.md')
    fs.writeFileSync(target, 'x')
    const link = path.join(dir, 'link.md')
    try {
      fs.symlinkSync(target, link)
    } catch {
      return // symlink creation is privileged on some platforms — skip
    }
    expect(() => writeManaged(link, 'y', [])).toThrow(/symlink/)
  })

  it('summarise counts each action', () => {
    expect(
      summarise([
        { path: 'a', action: 'created' },
        { path: 'b', action: 'unchanged' },
        { path: 'c', action: 'created' },
      ]),
    ).toEqual({ created: 2, updated: 0, unchanged: 1 })
  })
})
