import path from 'node:path'

import { getCheck } from '../checks/registry.ts'
import { type AgentTarget, writeAgentFiles } from './agentFiles.ts'
import { addVerifyScripts } from './packageScripts.ts'
import type { ManagedFileResult } from './writeManaged.ts'

export type InitOptions = {
  cwd: string
  /** Selected check names. */
  checks: readonly string[]
  targets: readonly AgentTarget[]
  /** When true, do not write `verify:*` scripts — rely on `verify`'s built-in defaults. */
  defaultsOnly: boolean
}

export type InitResult = {
  addedScripts: string[]
  /** devDependencies the selected external checks need (deduped). */
  devDeps: string[]
  agentFiles: ManagedFileResult[]
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

  const addedScripts = addVerifyScripts(path.join(opts.cwd, 'package.json'), scripts)
  const agentFiles = writeAgentFiles(opts.cwd, opts.targets)
  return { addedScripts, devDeps: [...new Set(devDeps)], agentFiles }
}
