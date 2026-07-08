import fs from 'node:fs'

import type { FileScore } from './analyze.ts'
import { forEachFunction } from './functions.ts'
import { calculateCyclomaticComplexity, calculateHalstead, calculateMaintainabilityIndex, countSloc } from './metrics.ts'

export const color = {
  red: (s: string | number) => `\x1b[31m${s}\x1b[39m`,
  green: (s: string | number) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s: string | number) => `\x1b[33m${s}\x1b[39m`,
  magenta: (s: string | number) => `\x1b[35m${s}\x1b[39m`,
  cyan: (s: string | number) => `\x1b[36m${s}\x1b[39m`,
  dim: (s: string | number) => `\x1b[2m${s}\x1b[22m`,
  bold: (s: string | number) => `\x1b[1m${s}\x1b[22m`,
  heading: (s: string | number) => `\x1b[1m\x1b[4m${s}\x1b[24m\x1b[22m`,
}

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
      `\nFail: ${failing.length} file(s) below threshold ${threshold}. Maintainability index (0–100) is derived from Halstead volume, cyclomatic complexity, and lines of code.\n\n⚠️  ${color.bold('Diagnose and fix one file at a time')} — do not investigate or fix multiple files in parallel. Run the CLI against a single <file> to see all metrics for one file. For larger files, start by extracting responsibilities into smaller files.`,
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
