import { CHECKS } from '../checks/registry.ts'
import type { CheckResult } from '../checks/types.ts'
import { color } from '../shared/color.ts'
import { runCommand } from '../shared/spawn.ts'
import { type MeasureRecord, printMeasureTable } from './measure.ts'
import { resolveEntries } from './resolveEntries.ts'

export type RunAllOptions = { measure?: boolean }

/**
 * Run every built-in check (the explicit `verifyx all` opt-in). A check runs in-process unless the project
 * defines a matching `verify:<name>` script, in which case that script runs instead (per-check override).
 */
export async function runAll(opts: RunAllOptions = {}): Promise<number> {
  const overrides = new Map(resolveEntries().map((entry) => [entry.name, entry]))

  console.log(`Running all ${CHECKS.length} built-in verification(s):`)
  for (const check of CHECKS) {
    console.log(`  - ${check.name}${overrides.has(`verify:${check.name}`) ? color.dim(' (overridden)') : ''}`)
  }
  console.log()

  const startTime = Date.now()
  const records: MeasureRecord[] = []
  const results: CheckResult[] = []
  for (const check of CHECKS) {
    const checkStart = Date.now()
    console.log(color.heading(`▶ ${check.name}`))
    const override = overrides.get(`verify:${check.name}`)
    const ok = override ? (await runCommand(override.command, { cwd: override.cwd })) === 0 : (await check.runDefault()).ok
    results.push({ name: check.name, ok })
    records.push({ script: check.name, code: ok ? 0 : 1, durationMs: Date.now() - checkStart })
    console.log()
  }

  if (opts.measure) printMeasureTable(records, Date.now() - startTime)

  const failed = results.filter((result) => !result.ok)
  if (failed.length > 0) {
    console.error(color.red(`\n${failed.length} verification(s) failed: ${failed.map((f) => f.name).join(', ')}`))
    return 1
  }
  console.log(color.green(`\nAll ${CHECKS.length} verification(s) passed`))
  return 0
}
