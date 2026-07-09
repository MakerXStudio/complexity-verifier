import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ensurePointer, type ManagedFileResult, writeManaged } from './writeManaged.ts'

export type AgentTarget = 'claude' | 'agents'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
// src/scaffold/*.ts and dist/scaffold/*.mjs both sit two levels below the package root, where templates/ lives.
const TEMPLATES_DIR = path.join(moduleDir, '..', '..', 'templates')

// A file already telling agents to run `npm run verify` is treated as covered — the pointer is not re-added.
const POINTER_MARKER = 'npm run verify'

function readTemplate(relativePath: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, ...relativePath.split('/')), 'utf-8')
}

/**
 * Emit the `verify` integration for the chosen targets under `cwd`:
 * - the same `SKILL.md` goes to Claude (`.claude/skills/verify/`) and the cross-vendor tree
 *   (`.agent-skills/verify/`), so the integration is identical across agents;
 * - a one-line pointer is appended to the matching instruction file (`CLAUDE.md` / `AGENTS.md`).
 *
 * Skills are CLI-owned (created/updated as a whole). The instruction files are user-owned, so the pointer is
 * only appended when absent and existing content is never rewritten.
 */
export function writeAgentFiles(rootDir: string, targets: readonly AgentTarget[]): ManagedFileResult[] {
  const results: ManagedFileResult[] = []
  const skill = readTemplate('skills/verify/SKILL.md')
  const pruneSkill = readTemplate('skills/prune-comments/SKILL.md')
  const commentRule = readTemplate('rules/comments-only-when-non-obvious.md')
  const guidance = readTemplate('verify-guidance.md')

  if (targets.includes('claude')) {
    writeManaged(path.join(rootDir, '.claude', 'skills', 'verify', 'SKILL.md'), skill, results)
    writeManaged(path.join(rootDir, '.claude', 'skills', 'prune-comments', 'SKILL.md'), pruneSkill, results)
    writeManaged(path.join(rootDir, '.claude', 'rules', 'comments-only-when-non-obvious.md'), commentRule, results)
    ensurePointer(path.join(rootDir, 'CLAUDE.md'), guidance, POINTER_MARKER, results)
  }
  if (targets.includes('agents')) {
    writeManaged(path.join(rootDir, '.agent-skills', 'verify', 'SKILL.md'), skill, results)
    writeManaged(path.join(rootDir, '.agent-skills', 'prune-comments', 'SKILL.md'), pruneSkill, results)
    writeManaged(path.join(rootDir, '.agent-skills', 'rules', 'comments-only-when-non-obvious.md'), commentRule, results)
    ensurePointer(path.join(rootDir, 'AGENTS.md'), guidance, POINTER_MARKER, results)
  }

  results.sort((a, b) => a.path.localeCompare(b.path))
  return results
}
