import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { type ManagedFileResult, writeManaged } from './writeManaged.ts'

export type AgentTarget = 'claude' | 'agents'

type ManagedFile = { template: string; dest: string }

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
// src/scaffold/*.ts and dist/scaffold/*.mjs both sit two levels below the package root, where templates/ lives.
const TEMPLATES_DIR = path.join(moduleDir, '..', '..', 'templates')

export function readTemplate(relativePath: string): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, ...relativePath.split('/')), 'utf-8')
}

/** The managed agent files to emit for the chosen targets. Claude gets a slash command + skill; others get a skill. */
export function managedFilesFor(targets: readonly AgentTarget[]): ManagedFile[] {
  const files: ManagedFile[] = []
  if (targets.includes('claude')) {
    files.push({ template: 'commands/verify.md', dest: '.claude/commands/verify.md' })
    files.push({ template: 'skills/verify/SKILL.md', dest: '.claude/skills/verify/SKILL.md' })
  }
  if (targets.includes('agents')) {
    files.push({ template: 'skills/verify/SKILL.md', dest: '.agent-skills/verify/SKILL.md' })
  }
  return files
}

/** Write (idempotently) the managed agent files for the chosen targets under `cwd`. */
export function writeAgentFiles(cwd: string, targets: readonly AgentTarget[]): ManagedFileResult[] {
  const results: ManagedFileResult[] = []
  for (const file of managedFilesFor(targets)) {
    writeManaged(path.join(cwd, ...file.dest.split('/')), readTemplate(file.template), results)
  }
  results.sort((a, b) => a.path.localeCompare(b.path))
  return results
}
