import fs from 'node:fs'
import path from 'node:path'

import { minimatch } from 'minimatch'

import { forEachFunction } from './functions.ts'
import { calculateCyclomaticComplexity, calculateHalstead, calculateMaintainabilityIndex, countSloc } from './metrics.ts'

const EXTENSIONS = ['.ts', '.tsx']

export const DEFAULT_IGNORE = ['**/*test.ts*']
export const DEFAULT_PATTERN = '{src,server,shared}/**/*.ts'

function walk(dir: string, results: string[]): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') walk(fullPath, results)
    } else if (entry.isFile() && EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
}

function matchUnder(dir: string, pattern: string | undefined, ignore: readonly string[]): string[] {
  const results: string[] = []
  walk(dir, results)
  return results.filter((f) => pattern === undefined || minimatch(f, pattern)).filter((f) => !ignore.some((glob) => minimatch(f, glob)))
}

export function findSourceFiles(pattern: string, ignore: readonly string[]): string[] {
  if (pattern.includes('*')) return matchUnder('.', pattern, ignore)
  if (fs.existsSync(pattern) && fs.statSync(pattern).isFile()) return [pattern]
  if (fs.existsSync(pattern) && fs.statSync(pattern).isDirectory()) return matchUnder(pattern, undefined, ignore)
  return matchUnder('.', pattern, ignore)
}

// A bare filename (no glob, no slash) is treated as a recursive search for it.
export function resolvePattern(pattern: string): string {
  return pattern.includes('*') || pattern.includes('/') ? pattern : `**/${pattern}`
}

export type FileScore = {
  file: string
  avg: number
  min: number
}

/** Per-file maintainability scoring: a file's score is the minimum MI across its functions. */
export function scoreFiles(files: readonly string[]): FileScore[] {
  const fileMetrics = new Map<string, { sloc: number; functions: number[] }>()
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    fileMetrics.set(file, { sloc: countSloc(content), functions: [] })
  }
  forEachFunction(files, (file, _name, node) => {
    const metrics = fileMetrics.get(file)
    if (!metrics) return
    const complexity = calculateCyclomaticComplexity(node)
    const { volume } = calculateHalstead(node)
    metrics.functions.push(calculateMaintainabilityIndex(volume, complexity, metrics.sloc))
  })

  const results: FileScore[] = []
  for (const [file, metrics] of fileMetrics) {
    if (metrics.functions.length === 0) continue
    const avg = metrics.functions.reduce((a, b) => a + b, 0) / metrics.functions.length
    const min = Math.min(...metrics.functions)
    results.push({ file, avg, min })
  }
  results.sort((a, b) => a.min - b.min)
  return results
}

export type AnalyzeOptions = {
  /** Glob pattern, directory, or file. Defaults to `{src,server,shared}/**\/*.ts`. */
  pattern?: string
  /** Extra ignore globs, appended to the default `**\/*test.ts*`. */
  ignore?: readonly string[]
  /** Fail files whose minimum MI is below this value. */
  threshold?: number
}

export type AnalyzeResult = {
  /** All scored files, sorted ascending by min MI. */
  results: FileScore[]
  /** Files below the threshold (empty when no threshold given). */
  failing: FileScore[]
  /** Resolved list of files that were analysed. */
  files: string[]
  /** True when a threshold was supplied and no file fell below it. */
  passed: boolean
}

/**
 * Analyse maintainability of TypeScript sources.
 * @returns scored files, plus which (if any) fall below the threshold.
 */
export function analyzeComplexity(options: AnalyzeOptions = {}): AnalyzeResult {
  const { pattern = DEFAULT_PATTERN, threshold } = options
  const ignore = [...DEFAULT_IGNORE, ...(options.ignore ?? [])]
  const files = findSourceFiles(resolvePattern(pattern), ignore)
  const results = scoreFiles(files)
  const failing = threshold !== undefined ? results.filter((r) => r.min < threshold) : []
  return { results, failing, files, passed: threshold !== undefined && failing.length === 0 }
}
