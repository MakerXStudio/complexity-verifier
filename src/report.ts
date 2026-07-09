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

/** Report comment blocks longer than the configured maximum. `warn` prints without failing; `pushback` adds AI back-pressure framing. */
export function printCommentBlockReport(
  violations: readonly CommentBlockViolation[],
  maxLines: number,
  opts: { pushback: boolean; warn: boolean },
): void {
  const list = violations.map((v) => `  ${v.file}:${v.line} → ${v.lines} lines`).join('\n')
  const message = `\n${opts.warn ? 'Warn' : 'Fail'}: ${violations.length} comment block(s) longer than ${maxLines} line(s).\n${list}\n\n${color.bold('Comments should explain *why*, not narrate *what*.')} Long comment blocks that describe implementation rot as the code changes, mislead future readers (and LLMs), and inflate complexity. Prefer self-documenting code: better names, smaller functions.\n\nIf the comment is genuinely durable context the code cannot express, prefix its first line with \`context:\` to keep it. JSDoc (\`/** … */\`) is always allowed.${opts.pushback ? PUSHBACK : ''}`
  if (opts.warn) {
    console.warn(color.yellow(message))
  } else {
    console.error(color.red(message))
  }
}

/** Report session-narration comments found on changed lines. `pushback` adds AI back-pressure framing. */
export function printNarrationReport(findings: readonly NewComment[], opts: { pushback: boolean }): void {
  const list = findings.map((c) => `  ${c.file}:${c.line} → ${c.text}`).join('\n')
  console.error(
    color.red(
      `\nFail: ${findings.length} narration comment(s) on changed lines.\n${list}\n\n${color.bold('These read as session narration — thinking out loud or restating *what* the next line does.')} They add no durable value and drift as the code changes. Delete them; let the code speak. If a line is genuinely durable context the code cannot express, prefix it with \`context:\`.${opts.pushback ? PUSHBACK : ''}`,
    ),
  )
}

/** Report files whose changed-line comment share exceeds the density threshold. */
export function printCommentDensityReport(violations: readonly DensityViolation[], opts: { threshold: number; pushback: boolean }): void {
  const pct = (n: number): string => `${Math.round(n * 100)}%`
  const list = violations.map((v) => `  ${v.file} → ${pct(v.ratio)} (${v.commentLines}/${v.added} added lines)`).join('\n')
  console.error(
    color.red(
      `\nFail: ${violations.length} file(s) over the ${pct(opts.threshold)} comment-density threshold on changed lines.\n${list}\n\n${color.bold('Too much of this change is comments.')} Dense comment runs usually narrate *what* the code does. Prefer self-documenting code: better names, smaller functions. Keep only comments that explain *why*; prefix genuinely durable context with \`context:\`. JSDoc (\`/** … */\`) is always allowed.${opts.pushback ? PUSHBACK : ''}`,
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
