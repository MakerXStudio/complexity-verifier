import { CHECKS } from '../checks/registry.ts'
import type { CheckResult } from '../checks/types.ts'
import { color } from '../shared/color.ts'
import { resolveMode } from '../shared/mode.ts'
import { runCommand } from '../shared/spawn.ts'
import { type MeasureRecord, printMeasureTable } from './measure.ts'
import { chatty, reportOutcomes } from './report.ts'
import { resolveEntries, resolveOverride } from './resolveEntries.ts'

export type RunAllOptions = { measure?: boolean }

/**
 * Run every built-in check (the explicit `verifyx all` opt-in). A check runs in-process unless the project
 * defines a matching `verify:<name>` script (or `verify:<name>:fix` in fix mode), in which case that script
 * runs instead (per-check override). A clean run is quiet — use `--verbose` / `--measure` for the roll-call.
 */
export async function runAll(opts: RunAllOptions = {}): Promise<number> {
  const entries = resolveEntries()
  const mode = resolveMode()
  const loud = chatty(opts.measure)

  if (loud) {
    console.log(`Running all ${CHECKS.length} built-in verification(s):`)
    for (const check of CHECKS) {
      console.log(`  - ${check.name}${resolveOverride(entries, check.name, mode) ? color.dim(' (overridden)') : ''}`)
    }
    console.log()
  }

  const startTime = Date.now()
  const records: MeasureRecord[] = []
  const results: CheckResult[] = []
  for (const check of CHECKS) {
    const checkStart = Date.now()
    if (loud) console.log(color.heading(`▶ ${check.name}`))
    const override = resolveOverride(entries, check.name, mode)
    const ok = override ? (await runCommand(override.command, { cwd: override.cwd })) === 0 : (await check.runDefault()).ok
    // On an override failure, show the script that actually ran (only on failure — passing runs stay silent).
    if (override && !ok) console.error(color.dim(`↳ ${check.name}: ran \`${override.command}\` (override)`))
    results.push({ name: check.name, ok })
    records.push({ script: check.name, code: ok ? 0 : 1, durationMs: Date.now() - checkStart })
    if (loud) console.log()
  }

  if (opts.measure) printMeasureTable(records, Date.now() - startTime)
  return reportOutcomes(results, 'verification', loud)
}
