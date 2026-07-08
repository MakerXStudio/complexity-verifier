import fs from 'node:fs'
import path from 'node:path'

import { color } from '../shared/color.ts'
import { runCommand } from '../shared/spawn.ts'
import type { Check, CheckResult } from './types.ts'

const BIN_EXTENSIONS = ['', '.cmd', '.ps1', '.exe']

/** True when a project-local binary is installed under node_modules/.bin (cross-platform). */
export function hasLocalBin(bin: string, cwd: string = process.cwd()): boolean {
  const dir = path.join(cwd, 'node_modules', '.bin')
  return BIN_EXTENSIONS.some((ext) => fs.existsSync(path.join(dir, bin + ext)))
}

export type ExternalCheckSpec = {
  name: string
  description: string
  /** The node_modules/.bin executable that must be present for the check to run. */
  bin: string
  /** The shell command run for the check (and written as the `verify:<name>` script by init). */
  command: string
  devDeps: string[]
  inDefaultRun?: boolean
}

/** Build a Check that shells out to an external tool, skipping gracefully when the tool is not installed. */
export function defineExternalCheck(spec: ExternalCheckSpec): Check {
  return {
    name: spec.name,
    description: spec.description,
    kind: 'external',
    inDefaultRun: spec.inDefaultRun ?? true,
    scaffold: { script: spec.command, devDeps: spec.devDeps },
    async runDefault(): Promise<CheckResult> {
      if (!hasLocalBin(spec.bin)) {
        console.log(color.dim(`${spec.name}: ${spec.bin} not installed — skipping (add it with \`verify init\`)`))
        return { name: spec.name, ok: true, skipped: true }
      }
      const code = await runCommand(spec.command)
      return { name: spec.name, ok: code === 0 }
    },
  }
}
