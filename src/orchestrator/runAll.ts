import { CHECKS } from '../checks/registry.ts'
import type { CheckResult } from '../checks/types.ts'
import { color } from '../shared/color.ts'
import { resolveMode } from '../shared/mode.ts'
import { runCommand } from '../shared/spawn.ts'
import { type MeasureRecord, printMeasureTable } from './measure.ts'
import { chatty, reportOutcomes } from './report.ts'
import { entryCheckName, resolveEntries, resolveOverride, selectEntries } from './resolveEntries.ts'

export type RunAllOptions = { measure?: boolean }

// Run a native/external check in-process, buffering its console output so a passing check stays silent (flushed on failure).
async function runQuietly(run: () => Promise<CheckResult>): Promise<CheckResult> {
  const chunks: string[] = []
  const original = { log: console.log, warn: console.warn, error: console.error }
  const capture = (...args: unknown[]): void => void chunks.push(args.map(String).join(' '))
  console.log = capture
  console.warn = capture
  console.error = capture
  let result: CheckResult
  try {
    result = await run()
  } finally {
    Object.assign(console, original)
  }
  if (!result.ok && chunks.length > 0) console.log(chunks.join('\n'))
  return result
}

/**
 * Run every built-in check (the explicit `verifyx all` opt-in) plus any custom `verify:*` scripts, so `all`
 * truly runs everything. A built-in runs in-process unless the project defines a matching `verify:<name>`
 * script (or `verify:<name>:fix` in fix mode), which overrides it. A clean run is quiet: passing checks print
 * nothing (output is buffered and flushed only on failure), use `--verbose` / `--measure` for the roll-call.
 */
export async function runAll(opts: RunAllOptions = {}): Promise<number> {
  const entries = resolveEntries()
  const mode = resolveMode()
  const loud = chatty(opts.measure)

  const builtinNames = new Set(CHECKS.map((c) => c.name))
  const customEntries = selectEntries(entries, mode).filter((entry) => !builtinNames.has(entryCheckName(entry.name)))

  if (loud) {
    console.log(`Running all ${CHECKS.length} built-in verification(s)${customEntries.length ? ` + ${customEntries.length} custom` : ''}:`)
    for (const check of CHECKS)
      console.log(`  - ${check.name}${resolveOverride(entries, check.name, mode) ? color.dim(' (overridden)') : ''}`)
    for (const entry of customEntries) console.log(`  - ${entry.name}${color.dim(' (custom)')}`)
    console.log()
  }

  const startTime = Date.now()
  const records: MeasureRecord[] = []
  const results: CheckResult[] = []

  const record = async (name: string, run: () => Promise<boolean>): Promise<void> => {
    const checkStart = Date.now()
    if (loud) console.log(color.heading(`▶ ${name}`))
    const ok = await run()
    results.push({ name, ok })
    records.push({ script: name, code: ok ? 0 : 1, durationMs: Date.now() - checkStart })
    if (loud) console.log()
  }

  for (const check of CHECKS) {
    const override = resolveOverride(entries, check.name, mode)
    await record(check.name, async () => {
      if (!override) return loud ? (await check.runDefault()).ok : (await runQuietly(() => check.runDefault())).ok
      const ok = (await runCommand(override.command, { cwd: override.cwd, quiet: !loud })) === 0
      // On an override failure, name the script that actually ran (only on failure: passing runs stay silent).
      if (!ok) console.error(color.dim(`↳ ${check.name}: ran \`${override.command}\` (override)`))
      return ok
    })
  }

  for (const entry of customEntries) {
    await record(entry.name, async () => (await runCommand(entry.command, { cwd: entry.cwd, quiet: !loud })) === 0)
  }

  if (opts.measure) printMeasureTable(records, Date.now() - startTime)
  return reportOutcomes(results, 'verification', loud)
}
