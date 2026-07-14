import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { appendArgs, captureCommand } from '../shared/spawn.ts'

/** Context handed to a counting run: the user's passthrough args, the PATH-augmented env, and the check's own command. */
type MaxWarningsCountContext = { extraArgs: string[]; env: Record<string, string>; checkCommand: string }

/** Opt-in capability that lets an external check tolerate up to `--max-warnings` findings by counting them itself. */
export type MaxWarningsSupport = {
  /** Singular label for one finding, pluralised in the over-budget summary, e.g. 'clone' → '6 clones found'. */
  unit: string
  /** Run the tool in machine-readable mode and return the total finding count. */
  count: (ctx: MaxWarningsCountContext) => Promise<number>
}

/** knip's JSON reporter attaches ownership metadata (not a finding) under this key; exclude it from the count. */
const KNIP_NON_FINDING_KEYS = new Set(['owners'])

/**
 * Total unused items in a knip `--reporter json` report: every finding array (files, exports, types,
 * dependencies, duplicate groups, …) summed across all issue rows. Robust to knip adding new issue types,
 * since any array-valued field counts; only ownership metadata and the row's `file` string are excluded.
 */
export function countKnipFindings(report: { issues?: Array<Record<string, unknown>> }): number {
  let total = 0
  for (const row of report.issues ?? []) {
    for (const [key, value] of Object.entries(row)) {
      if (!KNIP_NON_FINDING_KEYS.has(key) && Array.isArray(value)) total += value.length
    }
  }
  return total
}

/** Number of duplicate clones in a jscpd JSON report: the authoritative total, else the duplicates array length. */
export function countJscpdClones(report: { statistics?: { total?: { clones?: number } }; duplicates?: unknown[] }): number {
  return report.statistics?.total?.clones ?? report.duplicates?.length ?? 0
}

/** A counted check passes while findings stay at or below the budget; the budget itself is tolerated (inclusive). */
export function withinBudget(count: number, maxWarnings: number): boolean {
  return count <= maxWarnings
}

/** Count knip's findings by asking it for a JSON report on stdout (config-hint errors are irrelevant to the count). */
export async function knipCount(ctx: MaxWarningsCountContext): Promise<number> {
  const command = `${appendArgs('knip --no-progress', ctx.extraArgs)} --reporter json`
  const { stdout } = await captureCommand(command, { env: ctx.env })
  return countKnipFindings(JSON.parse(stdout))
}

/**
 * Count jscpd's clones. jscpd has no stdout JSON reporter, so run the check command (reusing its scan config) with a
 * JSON reporter written into a throwaway temp dir; the appended reporter flags override the command's console reporter.
 */
export async function jscpdCount(ctx: MaxWarningsCountContext): Promise<number> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verifyx-jscpd-'))
  try {
    await captureCommand(`${appendArgs(ctx.checkCommand, ctx.extraArgs)} --reporters json --output "${dir}" --silent`, { env: ctx.env })
    return countJscpdClones(JSON.parse(fs.readFileSync(path.join(dir, 'jscpd-report.json'), 'utf8')))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
