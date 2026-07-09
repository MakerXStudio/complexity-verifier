import path from 'node:path'

import { getCheck } from '../checks/registry.ts'
import type { Check } from '../checks/types.ts'
import { type AgentTarget, writeAgentFiles } from './agentFiles.ts'
import { resolveClaudeDir } from './claudeDir.ts'
import { ensureClaudeHook } from './claudeSettings.ts'
import { ensureKnipIgnores } from './knipConfig.ts'
import { addVerifyScripts } from './packageScripts.ts'
import type { ManagedFileResult } from './writeManaged.ts'

export type InitOptions = {
  cwd: string
  /** Selected check names. */
  checks: readonly string[]
  targets: readonly AgentTarget[]
  /** When true, do not write `verify:*` scripts — rely on `verify`'s built-in defaults. */
  defaultsOnly: boolean
  /** Register the edit-time comment gate as a Claude PostToolUse hook (claude target only). Default off. */
  commentHook?: boolean
  /** Explicit directory to write `.claude`/`.agent-skills` into; overrides the nearest-`.claude` resolution. */
  claudeDir?: string
}

export type InitResult = {
  addedScripts: string[]
  /** devDependencies the selected external checks need (deduped). */
  devDeps: string[]
  agentFiles: ManagedFileResult[]
  /** The directory the agent integration was written to (may differ from cwd in a monorepo). */
  rootDir: string
}

/** Pure scaffolding step: write package.json scripts + agent files, and report the devDeps to install. */
export function applyInit(opts: InitOptions): InitResult {
  const devDeps: string[] = []
  const scripts: Record<string, string> = {}

  for (const name of opts.checks) {
    const check = getCheck(name)
    if (!check) continue
    if (check.scaffold.devDeps) devDeps.push(...check.scaffold.devDeps)
    if (!opts.defaultsOnly) scripts[`verify:${name}`] = check.scaffold.script
  }

  // Defaults-only wires the top `verify` script to `verifyx all` so it runs every built-in with no verify:* list.
  const addedScripts = addVerifyScripts(path.join(opts.cwd, 'package.json'), scripts, opts.defaultsOnly ? 'verifyx all' : 'verifyx')

  // context: Claude Code loads settings only from its launch dir, so we attach to the nearest existing .claude
  // context: (the likely launch root), never a parent that isn't already a Claude project. See resolveClaudeDir.
  const rootDir = resolveClaudeDir(opts.cwd, opts.claudeDir)
  const agentFiles = writeAgentFiles(rootDir, opts.targets)

  // The PostToolUse hook is Claude-specific; other agents have no universal edit-time equivalent.
  if (opts.commentHook && opts.targets.includes('claude')) ensureClaudeHook(rootDir, agentFiles)

  // context: with unused-code selected, teach knip to ignore the other external tools verifyx runs at runtime.
  if (opts.checks.includes('unused-code')) {
    const toolDeps = opts.checks
      .map(getCheck)
      .filter((check): check is Check => !!check && check.kind === 'external' && check.name !== 'unused-code')
      .flatMap((check) => check.scaffold.devDeps ?? [])
      .filter((dep) => dep !== 'typescript')
    ensureKnipIgnores(opts.cwd, [...new Set(toolDeps)], agentFiles)
  }

  return { addedScripts, devDeps: [...new Set(devDeps)], agentFiles, rootDir }
}
