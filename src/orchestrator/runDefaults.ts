import { defaultChecks } from '../checks/registry.ts'
import type { CheckResult } from '../checks/types.ts'
import { color } from '../shared/color.ts'
import { type MeasureRecord, printMeasureTable } from './measure.ts'

export type RunDefaultsOptions = { measure?: boolean }

/**
 * Run the built-in default check set in-process (the convention when a project has no `verify:*` scripts).
 * Checks run sequentially with clear headers so their reports stay readable; each degrades to a pass/skip
 * when not applicable (no files, no diff, tool absent, no rules).
 */
export async function runDefaults(opts: RunDefaultsOptions = {}): Promise<number> {
  const checks = defaultChecks()
  console.log(`Running ${checks.length} built-in verification(s):`)
  for (const check of checks) console.log(`  - ${check.name}`)
  console.log()

  const startTime = Date.now()
  const records: MeasureRecord[] = []
  const results: CheckResult[] = []
  for (const check of checks) {
    const checkStart = Date.now()
    console.log(color.heading(`▶ ${check.name}`))
    const result = await check.runDefault()
    results.push(result)
    records.push({ script: check.name, code: result.ok ? 0 : 1, durationMs: Date.now() - checkStart })
    console.log()
  }

  if (opts.measure) printMeasureTable(records, Date.now() - startTime)

  const failed = results.filter((result) => !result.ok)
  if (failed.length > 0) {
    console.error(color.red(`\n${failed.length} verification(s) failed: ${failed.map((f) => f.name).join(', ')}`))
    return 1
  }
  console.log(color.green(`\nAll ${checks.length} verification(s) passed`))
  return 0
}
