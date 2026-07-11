import fs from 'node:fs'

import type { FileScore } from './analyze.ts'
import type { NewComment } from './checks/comment-common.ts'
import type { DensityViolation } from './checks/comment-heuristics.ts'
import type { CommentBlockViolation } from './comments.ts'
import { forEachFunction } from './functions.ts'
import { calculateCyclomaticComplexity, calculateHalstead, calculateMaintainabilityIndex, countSloc } from './metrics.ts'
import { color } from './shared/color.ts'

const FORMULA = '171 - 5.2*ln(HalsteadVolume) - 0.23*CyclomaticComplexity - 16.2*ln(SLOC), clamped 0-100'

export function printMaintainabilityReport(
  results: readonly FileScore[],
  failing: readonly FileScore[],
  threshold: number | undefined,
): void {
  console.log(color.dim(FORMULA))

  if (threshold !== undefined && failing.length === 0) {
    console.log(color.green('All files pass maintainability threshold'))
  } else {
    const shown = threshold !== undefined ? failing : results
    for (const { file, avg, min } of shown) {
      const paint = threshold !== undefined ? color.red : (s: string) => s
      console.log(`${paint(file)} → avg: ${color.cyan(avg.toFixed(1))}, min: ${color.yellow(min.toFixed(1))}`)
    }
  }

  console.log(color.dim(`\nAnalyzed ${results.length} files`))
}

export function printFailure(failing: readonly FileScore[], threshold: number): void {
  console.error(
    color.red(
      `\nFail: ${failing.length} file(s) below threshold ${threshold}. Maintainability index (0–100) is derived from Halstead volume, cyclomatic complexity, and lines of code.\n\n⚠️  ${color.bold('Diagnose and fix one file at a time')} — do not investigate or fix multiple files in parallel. Run the CLI against a single <file> to see all metrics for one file.\n\n${color.bold('The fix is to split the file')}: move functions/responsibilities into new files so each stays small. Do NOT game the metric by deleting comments, collapsing whitespace, joining lines, or shortening names — that reduces readability without reducing complexity, and formatting/lint will often undo it anyway.`,
    ),
  )
}

const PUSHBACK =
  '\n\n⚠️  THIS IS YOUR LAST CHANCE TO RECONSIDER BEFORE INVOLVING A HUMAN. Adding `context:` pages a real person to approve this comment. DO NOT WASTE THEIR TIME. You had BETTER BE RIGHT that this comment is genuinely necessary — that it explains *why*, not *what*, and that the code cannot simply be made self-explanatory. If in doubt, delete the comment.'

// with the context override disabled there is no sanctioned way to keep a flagged comment, so the standard
// pushback (which dangles the override + a human approver) would be nonsense; this variant never mentions it.
const STRICT_PUSHBACK =
  '\n\n⚠️  THIS IS YOUR LAST CHANCE TO RECONSIDER. This project runs the comment gate at its strictest: there is no escape hatch. Delete the comment, or make the code express the intent itself. Do NOT weaken, silence, or remove the check.'

/** Where the gate looked, for report wording. */
export type CommentScope = 'diff' | 'all'
const where = (scope: CommentScope): string => (scope === 'all' ? 'in the codebase' : 'on changed lines')

/** The `context:`/JSDoc "how to keep it" clause — collapses to JSDoc-only when the `context:` override is off. */
export function pushbackSuffix(opts: { pushback: boolean; contextOverride: boolean }): string {
  if (!opts.pushback) return ''
  return opts.contextOverride ? PUSHBACK : STRICT_PUSHBACK
}

type FindingReportOpts = { scope: CommentScope; pushback: boolean; contextOverride: boolean }
const findingList = (findings: readonly NewComment[]): string => findings.map((c) => `  ${c.file}:${c.line} → ${c.text}`).join('\n')

const keepClause = (contextOverride: boolean): string =>
  contextOverride
    ? 'If the comment is genuinely durable context the code cannot express, prefix its first line with `context:` to keep it. JSDoc (`/** … */`) is always allowed.'
    : 'JSDoc (`/** … */`) is the only exemption here — delete the comment or make the code self-documenting.'

/** Report comment blocks longer than the configured maximum. `warn` prints without failing; `pushback` adds AI back-pressure framing. */
export function printCommentBlockReport(
  violations: readonly CommentBlockViolation[],
  maxLines: number,
  opts: { pushback: boolean; warn: boolean; contextOverride: boolean },
): void {
  const list = violations.map((v) => `  ${v.file}:${v.line} → ${v.lines} lines`).join('\n')
  const message = `\n${opts.warn ? 'Warn' : 'Fail'}: ${violations.length} comment block(s) longer than ${maxLines} line(s).\n${list}\n\n${color.bold('Comments should explain *why*, not narrate *what*.')} Long comment blocks that describe implementation rot as the code changes, mislead future readers (and LLMs), and inflate complexity. Prefer self-documenting code: better names, smaller functions.\n\n${keepClause(opts.contextOverride)}${pushbackSuffix(opts)}`
  if (opts.warn) {
    console.warn(color.yellow(message))
  } else {
    console.error(color.red(message))
  }
}

/** Report every non-exempt comment in scope (the `--block-all` gate). `pushback` adds AI back-pressure framing. */
export function printBlockAllReport(findings: readonly NewComment[], opts: FindingReportOpts): void {
  const list = findingList(findings)
  const exempt = opts.contextOverride
    ? 'Machine directives and `context:`-prefixed comments are exempt (use that only where absolutely necessary; prefer deletion).'
    : 'Only JSDoc and machine directives are exempt — every other comment must go.'
  console.error(
    color.red(
      `\nFail: ${findings.length} comment(s) ${where(opts.scope)}.\n${list}\n\nWith --block-all, every comment ${where(opts.scope)} fails this gate. Remove them and let the code document itself. ${exempt}${pushbackSuffix(opts)}`,
    ),
  )
}

/** Report session-narration comments found in scope. `pushback` adds AI back-pressure framing. */
export function printNarrationReport(findings: readonly NewComment[], opts: FindingReportOpts): void {
  const list = findingList(findings)
  const keep = opts.contextOverride ? ' If a line is genuinely durable context the code cannot express, prefix it with `context:`.' : ''
  console.error(
    color.red(
      `\nFail: ${findings.length} narration comment(s) ${where(opts.scope)}.\n${list}\n\n${color.bold('These read as session narration — thinking out loud or restating *what* the next line does.')} They add no durable value and drift as the code changes. Delete them; let the code speak.${keep}${pushbackSuffix(opts)}`,
    ),
  )
}

/** Report files whose comment share in scope exceeds the density threshold. */
export function printCommentDensityReport(
  violations: readonly DensityViolation[],
  opts: { threshold: number; scope: CommentScope; pushback: boolean; contextOverride: boolean },
): void {
  const pct = (n: number): string => `${Math.round(n * 100)}%`
  const unit = opts.scope === 'all' ? 'lines' : 'added lines'
  const list = violations.map((v) => `  ${v.file} → ${pct(v.ratio)} (${v.commentLines}/${v.added} ${unit})`).join('\n')
  console.error(
    color.red(
      `\nFail: ${violations.length} file(s) over the ${pct(opts.threshold)} comment-density threshold ${where(opts.scope)}.\n${list}\n\n${color.bold('Too much of this is comments.')} Dense comment runs usually narrate *what* the code does. Prefer self-documenting code: better names, smaller functions. ${keepClause(opts.contextOverride)}${pushbackSuffix(opts)}`,
    ),
  )
}

function printSloc(file: string, content: string): void {
  console.log(color.heading('SLOC'))
  const lines = countSloc(content)
  console.log(`${file} → ${color.cyan(lines)} lines`)
  console.log(color.dim(`\nTotal: ${lines} lines across 1 files`))
}

function printCyclomatic(file: string): void {
  console.log()
  console.log(color.heading('Cyclomatic Complexity'))
  const cyc: Array<{ name: string; complexity: number }> = []
  forEachFunction([file], (_f, name, node) => {
    cyc.push({ name, complexity: calculateCyclomaticComplexity(node) })
  })
  cyc.sort((a, b) => b.complexity - a.complexity)
  for (const { name, complexity } of cyc) {
    console.log(`${file}:${name} → ${color.cyan(complexity)}`)
  }
  console.log(color.dim(`\nAnalyzed ${cyc.length} functions across 1 files`))
}

function printHalstead(file: string): void {
  console.log()
  console.log(color.heading('Halstead Metrics'))
  const hal: Array<{ name: string; volume: number; difficulty: number; effort: number }> = []
  forEachFunction([file], (_f, name, node) => {
    hal.push({ name, ...calculateHalstead(node) })
  })
  hal.sort((a, b) => b.effort - a.effort)
  for (const { name, volume, difficulty, effort } of hal) {
    console.log(
      `${file}:${name} → volume: ${color.cyan(volume.toFixed(1))}, difficulty: ${color.yellow(difficulty.toFixed(1))}, effort: ${color.magenta(effort.toFixed(1))}`,
    )
  }
  console.log(color.dim(`\nAnalyzed ${hal.length} functions across 1 files`))
}

function printMaintainability(file: string, content: string): void {
  console.log()
  console.log(color.heading('Maintainability Index'))
  console.log(color.dim(FORMULA))
  const sloc = countSloc(content)
  const scores: number[] = []
  forEachFunction([file], (_f, _name, node) => {
    const { volume } = calculateHalstead(node)
    scores.push(calculateMaintainabilityIndex(volume, calculateCyclomaticComplexity(node), sloc))
  })
  if (scores.length > 0) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    console.log(`${file} → avg: ${color.cyan(avg.toFixed(1))}, min: ${color.yellow(Math.min(...scores).toFixed(1))}`)
  }
  console.log(color.dim(`\nAnalyzed 1 files`))
}

/** Detailed per-metric breakdown printed when a single file is targeted. */
export function printFileDetail(file: string): void {
  const content = fs.readFileSync(file, 'utf-8')
  printSloc(file, content)
  printCyclomatic(file)
  printHalstead(file)
  printMaintainability(file, content)
}
