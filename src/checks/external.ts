import fs from 'node:fs'
import path from 'node:path'

import { color } from '../shared/color.ts'
import { resolveMode } from '../shared/mode.ts'
import { runCommand } from '../shared/spawn.ts'
import type { Check, CheckMode, CheckResult } from './types.ts'

const BIN_EXTENSIONS = ['', '.cmd', '.ps1', '.exe']

/** True when a project-local binary is installed under node_modules/.bin (cross-platform). */
export function hasLocalBin(bin: string, cwd: string = process.cwd()): boolean {
  const dir = path.join(cwd, 'node_modules', '.bin')
  return BIN_EXTENSIONS.some((ext) => fs.existsSync(path.join(dir, bin + ext)))
}

/**
 * Put the project's node_modules/.bin on PATH so tools resolve however `verify` was invoked
 * (npm script, npx, or directly) — npm only augments PATH when it runs a script itself.
 */
function envWithLocalBin(cwd: string = process.cwd()): Record<string, string> {
  const binDir = path.join(cwd, 'node_modules', '.bin')
  const pathKey = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
  return { [pathKey]: `${binDir}${path.delimiter}${process.env[pathKey] ?? ''}` }
}

export type ExternalCheckSpec = {
  name: string
  description: string
  /** The node_modules/.bin executable that must be present for the check to run. */
  bin: string
  /** Command run in check mode (report + fail, never rewrite). */
  checkCommand: string
  /** Command run in fix mode. When omitted, the check is not fixable and always runs `checkCommand`. */
  fixCommand?: string
  devDeps: string[]
  inDefaultRun?: boolean
  /** Extra guard beyond bin presence (e.g. require a tsconfig). */
  canRun?: () => boolean
}

/** Pick the command for the run mode: the fix command only in fix mode and only when the check is fixable. */
export function selectCommand(spec: Pick<ExternalCheckSpec, 'checkCommand' | 'fixCommand'>, mode: CheckMode): string {
  return mode === 'fix' && spec.fixCommand ? spec.fixCommand : spec.checkCommand
}

/** Build a Check that shells out to an external tool, skipping gracefully when the tool cannot run. */
export function defineExternalCheck(spec: ExternalCheckSpec): Check {
  return {
    name: spec.name,
    description: spec.description,
    kind: 'external',
    inDefaultRun: spec.inDefaultRun ?? true,
    // Scaffold as a call into this CLI so fix-vs-check lives in one place, not the consumer's script.
    scaffold: { script: `verify ${spec.name}`, devDeps: spec.devDeps },
    async runDefault(): Promise<CheckResult> {
      if (!hasLocalBin(spec.bin)) {
        console.log(color.dim(`${spec.name}: ${spec.bin} not installed — skipping (add it with \`verify init\`)`))
        return { name: spec.name, ok: true, skipped: true }
      }
      if (spec.canRun && !spec.canRun()) {
        console.log(color.dim(`${spec.name}: not applicable here — skipping`))
        return { name: spec.name, ok: true, skipped: true }
      }
      const command = selectCommand(spec, resolveMode())
      const code = await runCommand(command, { env: envWithLocalBin() })
      return { name: spec.name, ok: code === 0 }
    },
  }
}
