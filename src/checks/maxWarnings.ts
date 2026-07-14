import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { appendArgs, captureCommand } from '../shared/spawn.ts'

/** Context handed to a counting run: the user's passthrough args, the PATH-augmented env, and the check's own command. */
type MaxWarningsCountContext = { extraArgs: string[]; env: Record<string, string>; checkCommand: string }

/**
 * How a check applies a `--max-warnings <n>` budget:
 * - `flag`: the tool has its own budget option, so map n to the args to append — the tool's exit code is the verdict,
 *   which keeps any independent failures (e.g. knip config hints, operational errors) enforced regardless of n.
 * - `count`: the tool has no native gate, so verifyx counts findings from its machine-readable output and compares to n.
 */
export type MaxWarningsSupport =
  | { strategy: 'flag'; toArgs: (maxWarnings: number) => string[] }
  | { strategy: 'count'; unit: string; count: (ctx: MaxWarningsCountContext) => Promise<number> }

/** A counted check passes while findings stay at or below the budget; the budget itself is tolerated (inclusive). */
export function withinBudget(count: number, maxWarnings: number): boolean {
  return count <= maxWarnings
}

/**
 * Number of duplicate clones in a jscpd JSON report. A valid report always carries a non-negative integer
 * `statistics.total.clones` (or at least a `duplicates` array); any other shape is unrecognised and throws, so a
 * degraded or version-shifted report fails loudly rather than silently counting as zero.
 */
export function countJscpdClones(report: { statistics?: { total?: { clones?: unknown } }; duplicates?: unknown }): number {
  const clones = report.statistics?.total?.clones
  if (typeof clones === 'number' && Number.isInteger(clones) && clones >= 0) return clones
  if (Array.isArray(report.duplicates)) return report.duplicates.length
  throw new Error('unrecognised jscpd JSON report (no non-negative integer statistics.total.clones and no duplicates array)')
}

/**
 * Count jscpd's clones. jscpd has no stdout JSON reporter, so run the check command (reusing its scan config) with a
 * JSON reporter written into a throwaway temp dir; the appended reporter flags override the command's console reporter.
 */
export async function jscpdCount(ctx: MaxWarningsCountContext): Promise<number> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verifyx-jscpd-'))
  try {
    const command = `${appendArgs(ctx.checkCommand, ctx.extraArgs)} --reporters json --output "${dir}" --silent`
    const { code, stderr } = await captureCommand(command, { env: ctx.env })
    const reportPath = path.join(dir, 'jscpd-report.json')
    // No report means the run itself failed (e.g. a passthrough flag colliding with the appended ones) — surface the
    // tool's own stderr so the "could not count" error is actionable, rather than a bare ENOENT from reading the file.
    if (!fs.existsSync(reportPath)) throw new Error(`jscpd produced no report (exit ${code})${stderr.trim() ? `: ${stderr.trim()}` : ''}`)
    return countJscpdClones(JSON.parse(fs.readFileSync(reportPath, 'utf8')))
  } finally {
    // maxRetries covers a transient Windows lock (AV/indexer) on the just-written report so cleanup can't fail the check.
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  }
}
