import fs from 'node:fs'
import path from 'node:path'

import { color } from '../shared/color.ts'
import { resolveMode } from '../shared/mode.ts'
import { runCommand } from '../shared/spawn.ts'
import type { Check, CheckMode, CheckResult, RunDefaultOptions } from './types.ts'

const BIN_EXTENSIONS = ['', '.cmd', '.ps1', '.exe']

/** True when a project-local binary is installed under node_modules/.bin (cross-platform). */
function hasLocalBin(bin: string, cwd: string = process.cwd()): boolean {
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
  recommended?: boolean
  /** Docs / config reference for the underlying tool, surfaced when the check fails. */
  docs?: string
  /** Extra guard beyond bin presence (e.g. require a tsconfig). */
  canRun?: () => boolean
  /**
   * Default trailing args scaffolded after `--` (e.g. skott's `src/*.ts` target), surfaced in the `verify:<name>`
   * script so a consumer can see and tweak them. Not baked into `runDefault`; only the scaffolded script carries them.
   */
  scaffoldArgs?: string
}

/** Append user/scaffold `extraArgs` to an external tool's command, preserving shell semantics (globs unquoted). */
export function appendArgs(command: string, extraArgs: readonly string[] = []): string {
  return extraArgs.length > 0 ? `${command} ${extraArgs.join(' ')}` : command
}

/** Pick the command for the run mode: the fix command only in fix mode and only when the check is fixable. */
export function selectCommand(spec: Pick<ExternalCheckSpec, 'checkCommand' | 'fixCommand'>, mode: CheckMode): string {
  return mode === 'fix' && spec.fixCommand ? spec.fixCommand : spec.checkCommand
}

/**
 * The line printed when an external check fails: names the tool (checks are named for their function, so the
 * tool is otherwise hidden), the exact command that ran, and where to configure it — so an agent can set up
 * the tool's config file (e.g. knip.json) without guessing.
 */
export function externalFailureHint(spec: Pick<ExternalCheckSpec, 'name' | 'bin' | 'docs'>, command: string): string {
  return `↳ ${spec.name} uses ${spec.bin}: ran \`${command}\`. Configure ${spec.bin}${spec.docs ? ` — ${spec.docs}` : ''}.`
}

/** Build a Check that shells out to an external tool, skipping gracefully when the tool cannot run. */
export function defineExternalCheck(spec: ExternalCheckSpec): Check {
  return {
    name: spec.name,
    description: spec.description,
    kind: 'external',
    recommended: spec.recommended ?? false,
    // Scaffold as a call into this CLI so fix-vs-check lives in one place, not the consumer's script.
    scaffold: {
      script: spec.scaffoldArgs ? `verifyx ${spec.name} -- ${spec.scaffoldArgs}` : `verifyx ${spec.name}`,
      devDeps: spec.devDeps,
    },
    // `verifyx eject <name>` inlines these raw commands into the consumer's verify:* scripts.
    eject: { check: spec.checkCommand, fix: spec.fixCommand },
    async runDefault({ extraArgs }: RunDefaultOptions = {}): Promise<CheckResult> {
      if (!hasLocalBin(spec.bin)) {
        console.log(color.dim(`${spec.name}: ${spec.bin} not installed — skipping (add it with \`npx verifyx init\`)`))
        return { name: spec.name, ok: true, skipped: true }
      }
      if (spec.canRun && !spec.canRun()) {
        console.log(color.dim(`${spec.name}: not applicable here — skipping`))
        return { name: spec.name, ok: true, skipped: true }
      }
      const command = appendArgs(selectCommand(spec, resolveMode()), extraArgs)
      // quiet: buffer the tool's output and flush only on failure (streamed live under --verbose).
      const code = await runCommand(command, { env: envWithLocalBin(), quiet: true })
      // Only on failure — passing runs stay silent to save tokens.
      if (code !== 0) console.error(color.dim(externalFailureHint(spec, command)))
      return { name: spec.name, ok: code === 0 }
    },
  }
}
