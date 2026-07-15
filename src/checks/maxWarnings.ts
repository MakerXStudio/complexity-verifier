import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { appendArgs, captureCommand } from '../shared/spawn.ts'

type MaxWarningsCountContext = { extraArgs: string[]; env: Record<string, string>; checkCommand: string }

export type MaxWarningsSupport =
  | { strategy: 'flag'; toArgs: (maxWarnings: number) => string[] }
  | { strategy: 'count'; unit: string; count: (ctx: MaxWarningsCountContext) => Promise<number> }

export function withinBudget(count: number, maxWarnings: number): boolean {
  return count <= maxWarnings
}

export function countJscpdClones(report: { statistics?: { total?: { clones?: unknown } }; duplicates?: unknown }): number {
  const clones = report.statistics?.total?.clones
  if (typeof clones === 'number' && Number.isInteger(clones) && clones >= 0) return clones
  if (Array.isArray(report.duplicates)) return report.duplicates.length
  throw new Error('unrecognised jscpd JSON report (no non-negative integer statistics.total.clones and no duplicates array)')
}

// jscpd writes JSON reports to disk; later reporter flags override its configured console reporter.
export async function jscpdCount(ctx: MaxWarningsCountContext): Promise<number> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verifyx-jscpd-'))
  try {
    const command = `${appendArgs(ctx.checkCommand, ctx.extraArgs)} --reporters json --output "${dir}" --silent`
    const { code, stderr } = await captureCommand(command, { env: ctx.env })
    const reportPath = path.join(dir, 'jscpd-report.json')
    if (!fs.existsSync(reportPath)) throw new Error(`jscpd produced no report (exit ${code})${stderr.trim() ? `: ${stderr.trim()}` : ''}`)
    return countJscpdClones(JSON.parse(fs.readFileSync(reportPath, 'utf8')))
  } finally {
    // Retry transient Windows locks on the new report.
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  }
}
