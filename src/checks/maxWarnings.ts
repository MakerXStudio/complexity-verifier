import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { appendArgs, captureCommand } from '../shared/spawn.ts'

type MaxWarningsCountContext = { extraArgs: string[]; env: Record<string, string>; checkCommand: string }

/** The finding count plus the tool's rendered console report, so a failing budget can print it without a second run. */
export type CountResult = { count: number; report: string }

export type MaxWarningsSupport =
  | { strategy: 'flag'; toArgs: (maxWarnings: number) => string[] }
  | { strategy: 'count'; unit: string; count: (ctx: MaxWarningsCountContext) => Promise<CountResult> }

export function withinBudget(count: number, maxWarnings: number): boolean {
  return count <= maxWarnings
}

export function countJscpdClones(report: { statistics?: { total?: { clones?: unknown } }; duplicates?: unknown }): number {
  const clones = report.statistics?.total?.clones
  if (typeof clones === 'number' && Number.isInteger(clones) && clones >= 0) return clones
  if (Array.isArray(report.duplicates)) return report.duplicates.length
  throw new Error('unrecognised jscpd JSON report (no non-negative integer statistics.total.clones and no duplicates array)')
}

// jscpd reporter flags accumulate, so appending `--reporters json` keeps the configured console reporter running:
// one invocation yields both the clone count (JSON on disk) and the console report (captured for the failure path).
export async function jscpdCount(ctx: MaxWarningsCountContext): Promise<CountResult> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verifyx-jscpd-'))
  try {
    const command = `${appendArgs(ctx.checkCommand, ctx.extraArgs)} --reporters json --output "${dir}"`
    const { code, stdout, stderr } = await captureCommand(command, { env: ctx.env })
    const reportPath = path.join(dir, 'jscpd-report.json')
    if (!fs.existsSync(reportPath)) throw new Error(`jscpd produced no report (exit ${code})${stderr.trim() ? `: ${stderr.trim()}` : ''}`)
    const count = countJscpdClones(JSON.parse(fs.readFileSync(reportPath, 'utf8')))
    // Drop the json reporter's "report saved to <dir>" line — the temp dir is deleted before anyone could read it.
    const report = (stdout + stderr)
      .split('\n')
      .filter((line) => !line.includes(dir))
      .join('\n')
    return { count, report }
  } finally {
    // Retry transient Windows locks on the new report.
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  }
}
