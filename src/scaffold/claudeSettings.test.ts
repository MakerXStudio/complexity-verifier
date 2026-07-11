import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ensureClaudeHook, HOOK_COMMAND } from './claudeSettings.ts'
import type { ManagedFileResult } from './writeManaged.ts'

let dir: string
const settingsPath = (): string => path.join(dir, '.claude', 'settings.json')
const read = (): Record<string, unknown> => JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'))

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'verify-settings-')))
})
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function run(): ManagedFileResult[] {
  const results: ManagedFileResult[] = []
  ensureClaudeHook(dir, results)
  return results
}

describe('ensureClaudeHook', () => {
  it('creates settings.json with the PostToolUse hook when none exists', () => {
    const [result] = run()
    expect(result).toEqual({ path: settingsPath(), action: 'created' })
    const command = read().hooks as { PostToolUse: { hooks: { command: string }[] }[] }
    expect(command.PostToolUse[0]?.hooks[0]?.command).toBe(HOOK_COMMAND)
  })

  it('merges the hook without clobbering existing settings', () => {
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true })
    fs.writeFileSync(settingsPath(), JSON.stringify({ model: 'opus', hooks: { PreToolUse: [] } }, null, 2))
    const [result] = run()
    expect(result?.action).toBe('updated')
    const settings = read() as { model: string; hooks: { PreToolUse: unknown[]; PostToolUse: unknown[] } }
    expect(settings.model).toBe('opus')
    expect(settings.hooks.PreToolUse).toEqual([])
    expect(settings.hooks.PostToolUse).toHaveLength(1)
  })

  it('is idempotent — re-running does not duplicate the hook', () => {
    run()
    const [result] = run()
    expect(result?.action).toBe('unchanged')
    const settings = read() as { hooks: { PostToolUse: unknown[] } }
    expect(settings.hooks.PostToolUse).toHaveLength(1)
  })

  it('leaves unparseable settings untouched', () => {
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true })
    fs.writeFileSync(settingsPath(), '{ not valid json')
    const [result] = run()
    expect(result?.action).toBe('unchanged')
    expect(fs.readFileSync(settingsPath(), 'utf-8')).toBe('{ not valid json')
  })
})
