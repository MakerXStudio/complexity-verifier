import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { captureArgvCommand } from '../shared/spawn.ts'

type MaxWarningsCountContext = { argv: readonly string[]; env: Record<string, string> }

/** The finding count plus the tool's rendered console report, so a failing budget can print it without a second run. */
export type CountResult = { count: number; report: string }

export type MaxWarningsSupport =
  | { strategy: 'flag'; toArgs: (maxWarnings: number) => string[] }
  | { strategy: 'count'; unit: string; count: (ctx: MaxWarningsCountContext) => Promise<CountResult> }

export function withinBudget(count: number, maxWarnings: number): boolean {
  return count <= maxWarnings
}

type CloneRange = { name: string; start: number; end: number }
type CloneRanges = [CloneRange, CloneRange]

function parseCloneRange(value: unknown): CloneRange | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { name, start, end } = value as { name?: unknown; start?: unknown; end?: unknown }
  if (typeof name !== 'string' || typeof start !== 'number' || typeof end !== 'number') return undefined
  return { name, start, end }
}

function parseCloneRangePairs(duplicates: readonly unknown[]): CloneRanges[] | undefined {
  const pairs: CloneRanges[] = []
  for (const entry of duplicates) {
    const { firstFile, secondFile } = (entry ?? {}) as { firstFile?: unknown; secondFile?: unknown }
    const a = parseCloneRange(firstFile)
    const b = parseCloneRange(secondFile)
    if (!a || !b) return undefined
    pairs.push([a, b])
  }
  return pairs
}

function rangesOverlap(a: CloneRange, b: CloneRange): boolean {
  return a.name === b.name && a.start <= b.end && b.start <= a.end
}

function clonesShareRegion(a: CloneRanges, b: CloneRanges): boolean {
  return a.some((aRange) => b.some((bRange) => rangesOverlap(aRange, bRange)))
}

/** One pattern across N files yields N-1 jscpd pairs (plus overlapping re-reports), so the budget gates on connected components, not raw pairs. */
function countDistinctCloneRegions(pairs: readonly CloneRanges[]): number {
  const regionOf = pairs.map((_, i) => i)
  const rootOf = (i: number): number => (regionOf[i] === i ? i : (regionOf[i] = rootOf(regionOf[i] as number)))
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      if (clonesShareRegion(pairs[i] as CloneRanges, pairs[j] as CloneRanges)) regionOf[rootOf(j)] = rootOf(i)
    }
  }
  return new Set(pairs.map((_, i) => rootOf(i))).size
}

export function countJscpdClones(report: { statistics?: { total?: { clones?: unknown } }; duplicates?: unknown }): number {
  if (Array.isArray(report.duplicates)) {
    const pairs = parseCloneRangePairs(report.duplicates)
    if (pairs) return countDistinctCloneRegions(pairs)
  }
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
    const argv = [...ctx.argv, '--reporters', 'json', '--output', dir]
    const { code, stdout, stderr } = await captureArgvCommand(argv, { env: ctx.env })
    const reportPath = path.join(dir, 'jscpd-report.json')
    if (!fs.existsSync(reportPath)) throw new Error(`jscpd produced no report (exit ${code})${stderr.trim() ? `: ${stderr.trim()}` : ''}`)
    const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as { duplicates?: unknown }
    const count = countJscpdClones(parsed)
    const rawClones = Array.isArray(parsed.duplicates) ? parsed.duplicates.length : count
    // Drop the json reporter's "report saved to <dir>" line — the temp dir is deleted before anyone could read it.
    let report = (stdout + stderr)
      .split('\n')
      .filter((line) => !line.includes(dir))
      .join('\n')
    if (rawClones > count) report += `\n↳ ${count} distinct duplicated region(s) merged from ${rawClones} raw jscpd clone(s).\n`
    return { count, report }
  } finally {
    // Retry transient Windows locks on the new report.
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  }
}
