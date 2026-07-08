import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { analyzeComplexity, resolvePattern, scoreFiles } from './analyze.ts'

let dir: string
let originalCwd: string

beforeEach(() => {
  originalCwd = process.cwd()
  // Real filesystem, resolved to avoid macOS /var -> /private/var symlink surprises.
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cv-')))
})

afterEach(() => {
  process.chdir(originalCwd)
  fs.rmSync(dir, { recursive: true, force: true })
})

function write(name: string, content: string): string {
  const file = path.join(dir, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  return file
}

describe('scoreFiles', () => {
  it("uses the minimum MI across a file's functions", () => {
    // Padded with real statements so the file's SLOC (and thus low MI) is unmistakable.
    const branches = Array.from(
      { length: 15 },
      (_, i) => `      if (i % ${i + 2} === 0 && b > c || c === ${i}) { total += i ? i * b : c - b }`,
    ).join('\n')
    const gnarly = `function gnarly(a: number, b: number, c: number) {
      let total = 0
      for (let i = 0; i < a; i++) {
${branches}
        while (total > 100) { total = total - b - c || 0 }
      }
      return total > 0 ? total : -total
    }`
    const file = write('mixed.ts', `function tiny() { return 1 }\n${gnarly}\n`)
    const scores = scoreFiles([file])
    const score = scores[0]
    expect(score).toBeDefined()
    if (!score) return
    expect(score.min).toBeLessThan(score.avg)
    // tiny() scores 100; min must come from the gnarly function
    expect(score.min).toBeLessThan(100)
  })

  it('skips files with no functions', () => {
    const file = write('consts.ts', 'export const a = 1\nexport const b = 2\n')
    expect(scoreFiles([file])).toEqual([])
  })

  it('sorts results ascending by min', () => {
    const trivial = write('a.ts', 'function a() { return 1 }\n')
    const branchy = write(
      'b.ts',
      `function b(x: number, y: number, z: number) {
        let t = 0
        if (x > 0 && x < 10 || x === 42) { t += x ? x * 2 : 0 }
        for (const w of [1, 2, 3]) { if (w > y && w < z) t -= w }
        while (t > 100) { t = t - y - z || 0 }
        return t > 0 ? t : -t
      }`,
    )
    const results = scoreFiles([trivial, branchy])
    const mins = results.map((r) => r.min)
    expect(mins).toEqual([...mins].sort((p, q) => p - q))
    // The branchy file must not score better (higher) than the trivial one.
    const branchyScore = results.find((r) => r.file === branchy)?.min ?? 0
    const trivialScore = results.find((r) => r.file === trivial)?.min ?? 0
    expect(branchyScore).toBeLessThanOrEqual(trivialScore)
  })
})

describe('analyzeComplexity', () => {
  // The tool walks from cwd and matches with minimatch, so run each case inside the temp dir.
  it('flags files below the threshold as failing', () => {
    // Enough SLOC + branching that the MI drops well below the threshold.
    const body = Array.from({ length: 20 }, (_, i) => `  if (x > ${i} && y < ${i} || z === ${i}) { total += x ? y - z : z - y }`).join('\n')
    write(
      'src/hard.ts',
      `export function hard(x: number, y: number, z: number) {\n  let total = 0\n${body}\n  return total > 0 ? total : -total\n}`,
    )
    process.chdir(dir)
    const result = analyzeComplexity({ pattern: 'src/**/*.ts', threshold: 65 })
    expect(result.failing.length).toBe(1)
    expect(result.passed).toBe(false)
  })

  it('passes when every file is above the threshold', () => {
    write('src/easy.ts', 'export function easy() { return 1 }\n')
    process.chdir(dir)
    const result = analyzeComplexity({ pattern: 'src/**/*.ts', threshold: 1 })
    expect(result.failing).toEqual([])
    expect(result.passed).toBe(true)
  })

  it('reports no failures and passed=false when no threshold is given', () => {
    write('src/easy.ts', 'export function easy() { return 1 }\n')
    process.chdir(dir)
    const result = analyzeComplexity({ pattern: 'src/**/*.ts' })
    expect(result.failing).toEqual([])
    expect(result.passed).toBe(false)
  })

  it('applies extra ignore globs on top of the default test ignore', () => {
    write('src/keep.ts', 'export function keep() { return 1 }\n')
    write('src/skip.ts', 'export function skip() { return 2 }\n')
    write('src/thing.test.ts', 'export function t() { return 3 }\n')
    process.chdir(dir)
    const result = analyzeComplexity({ pattern: 'src/**/*.ts', ignore: ['**/skip.ts'] })
    const names = result.files.map((f) => path.basename(f)).sort()
    expect(names).toEqual(['keep.ts'])
  })
})

describe('resolvePattern', () => {
  it('leaves glob patterns untouched', () => {
    expect(resolvePattern('src/**/*.ts')).toBe('src/**/*.ts')
  })

  it('leaves path-like patterns untouched', () => {
    expect(resolvePattern('src/index.ts')).toBe('src/index.ts')
  })

  it('turns a bare filename into a recursive search', () => {
    expect(resolvePattern('index.ts')).toBe('**/index.ts')
  })
})
