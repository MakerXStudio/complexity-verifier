import fs from 'node:fs'
import path from 'node:path'

import { color } from '../shared/color.ts'
import { resolveMode } from '../shared/mode.ts'
import { emit } from '../shared/output.ts'
import { appendArgs, captureCommand, runCommand } from '../shared/spawn.ts'
import { type MaxWarningsSupport, withinBudget } from './maxWarnings.ts'
import type { Check, CheckMode, CheckResult, RunDefaultOptions } from './types.ts'

export { appendArgs } from '../shared/spawn.ts'

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
  /** Rewrite the tool's captured output before it is printed, e.g. to strip a tool's own hardcoded colouring. */
  transformOutput?: (output: string) => string
  /**
   * Default trailing args scaffolded after `--` (e.g. skott's `src/*.ts` target), surfaced in the `verify:<name>`
   * script so a consumer can see and tweak them. Not baked into `runDefault`; only the scaffolded script carries them.
   */
  scaffoldArgs?: string
  /** Present only for checks that support `--max-warnings`; defines how to count findings for the tolerance gate. */
  maxWarnings?: MaxWarningsSupport
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

type CountBudget = Extract<MaxWarningsSupport, { strategy: 'count' }>
type CountableSpec = Pick<ExternalCheckSpec, 'name' | 'bin' | 'checkCommand' | 'fixCommand' | 'docs' | 'transformOutput'>

/**
 * Run a check whose tool has no native budget under a `--max-warnings` budget: count findings via the tool's
 * machine-readable output and pass while the count stays at or below the budget. On over-budget, print a one-line
 * summary, then the tool's normal report (re-run and shown regardless of its own exit code), then the failure hint.
 * A counting error fails loudly rather than passing silently.
 */
export async function runCountedBudget(
  spec: CountableSpec,
  budget: CountBudget,
  maxWarnings: number,
  extraArgs: string[],
  env: Record<string, string>,
): Promise<CheckResult> {
  let count: number
  try {
    count = await budget.count({ extraArgs, env, checkCommand: spec.checkCommand })
  } catch (error) {
    const docs = spec.docs ? ` — ${spec.docs}` : ''
    console.error(
      color.dim(
        `↳ ${spec.name}: could not count ${spec.bin} findings for --max-warnings (${String(error)}). Configure ${spec.bin}${docs}.`,
      ),
    )
    return { name: spec.name, ok: false }
  }
  if (withinBudget(count, maxWarnings)) return { name: spec.name, ok: true }

  const unit = count === 1 ? budget.unit : `${budget.unit}s`
  console.error(color.dim(`↳ ${spec.name}: ${count} ${unit} found, exceeds --max-warnings ${maxWarnings}.`))
  const command = appendArgs(selectCommand(spec, resolveMode()), extraArgs)
  // Keep both channels: the report is on stdout, but an actionable config/module error may be on stderr.
  const { stdout, stderr } = await captureCommand(command, { env })
  const report = stdout + stderr
  if (report) emit(spec.transformOutput ? spec.transformOutput(report) : report)
  console.error(color.dim(externalFailureHint(spec, command)))
  return { name: spec.name, ok: false }
}

/** Build a Check that shells out to an external tool, skipping gracefully when the tool cannot run. */
export function defineExternalCheck(spec: ExternalCheckSpec): Check {
  return {
    name: spec.name,
    description: spec.description,
    kind: 'external',
    recommended: spec.recommended ?? false,
    supportsMaxWarnings: !!spec.maxWarnings,
    // Scaffold as a call into this CLI so fix-vs-check lives in one place, not the consumer's script.
    scaffold: {
      script: spec.scaffoldArgs ? `verifyx ${spec.name} -- ${spec.scaffoldArgs}` : `verifyx ${spec.name}`,
      devDeps: spec.devDeps,
    },
    // `verifyx eject <name>` inlines these raw commands into the consumer's verify:* scripts.
    eject: { check: spec.checkCommand, fix: spec.fixCommand },
    async runDefault({ extraArgs = [], maxWarnings }: RunDefaultOptions = {}): Promise<CheckResult> {
      if (!hasLocalBin(spec.bin)) {
        console.log(color.dim(`${spec.name}: ${spec.bin} not installed — skipping (add it with \`npx verifyx init\`)`))
        return { name: spec.name, ok: true, skipped: true }
      }
      if (spec.canRun && !spec.canRun()) {
        console.log(color.dim(`${spec.name}: not applicable here — skipping`))
        return { name: spec.name, ok: true, skipped: true }
      }
      const budget = maxWarnings !== undefined ? spec.maxWarnings : undefined
      if (budget?.strategy === 'count') {
        return runCountedBudget(spec, budget, maxWarnings as number, extraArgs, envWithLocalBin())
      }
      // A `flag`-strategy budget just augments the normal command with the tool's own budget option.
      const budgetArgs = budget?.strategy === 'flag' ? budget.toArgs(maxWarnings as number) : []
      const command = appendArgs(selectCommand(spec, resolveMode()), [...extraArgs, ...budgetArgs])
      // quiet: buffer the tool's output and flush only on failure (streamed live under --verbose).
      const code = await runCommand(command, { env: envWithLocalBin(), quiet: true, transform: spec.transformOutput })
      // Only on failure — passing runs stay silent to save tokens.
      if (code !== 0) console.error(color.dim(externalFailureHint(spec, command)))
      return { name: spec.name, ok: code === 0 }
    },
  }
}
