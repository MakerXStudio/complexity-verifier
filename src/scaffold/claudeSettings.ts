import fs from 'node:fs'
import path from 'node:path'

import type { ManagedFileResult } from './writeManaged.ts'

// context: the edit-time comment gate is a PostToolUse hook that runs after the agent edits a file; the marker
// lets us detect our own entry so re-running init never duplicates it.
export const HOOK_COMMAND = 'npx verifyx comments-hook'
const HOOK_MATCHER = 'Edit|Write|MultiEdit'

type HookEntry = { type?: string; command?: string }
type HookGroup = { matcher?: string; hooks?: HookEntry[] }
type ClaudeSettings = { hooks?: { PostToolUse?: HookGroup[] } & Record<string, unknown> } & Record<string, unknown>

function hasOurHook(settings: ClaudeSettings): boolean {
  const groups = settings.hooks?.PostToolUse ?? []
  return groups.some((g) => (g.hooks ?? []).some((h) => (h.command ?? '').includes(HOOK_COMMAND)))
}

function addOurHook(settings: ClaudeSettings): void {
  const hooks = (settings.hooks ??= {})
  const post = (hooks.PostToolUse ??= [])
  post.push({ matcher: HOOK_MATCHER, hooks: [{ type: 'command', command: HOOK_COMMAND }] })
}

/**
 * Ensure the project's `.claude/settings.json` registers the `verifyx comments-hook` PostToolUse hook, so the
 * comment gate fires the moment an agent edits a file. Merges into existing settings — never rewrites unrelated
 * keys — and is idempotent (detects our entry by its command). Leaves unparseable settings untouched.
 */
export function ensureClaudeHook(cwd: string, results: ManagedFileResult[]): void {
  const file = path.join(cwd, '.claude', 'settings.json')

  if (!fs.existsSync(file)) {
    const settings: ClaudeSettings = {}
    addOurHook(settings)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`)
    results.push({ path: file, action: 'created' })
    return
  }

  let settings: ClaudeSettings
  try {
    settings = JSON.parse(fs.readFileSync(file, 'utf-8')) as ClaudeSettings
  } catch {
    // context: never clobber settings we can't parse — leave the file for the user to fix and report no change.
    results.push({ path: file, action: 'unchanged' })
    return
  }

  if (hasOurHook(settings)) {
    results.push({ path: file, action: 'unchanged' })
    return
  }

  addOurHook(settings)
  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`)
  results.push({ path: file, action: 'updated' })
}
