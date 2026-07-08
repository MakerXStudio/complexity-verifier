import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { calculateCyclomaticComplexity, calculateHalstead, calculateMaintainabilityIndex, countSloc } from './metrics.ts'

function firstFunction(code: string): ts.Node {
  const sf = ts.createSourceFile('t.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let found: ts.Node | undefined
  const visit = (n: ts.Node): void => {
    if (!found && (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n))) found = n
    ts.forEachChild(n, visit)
  }
  visit(sf)
  if (!found) throw new Error('no function found')
  return found
}

describe('calculateCyclomaticComplexity', () => {
  it('is 1 for a straight-line function', () => {
    expect(calculateCyclomaticComplexity(firstFunction('function f() { return 1 }'))).toBe(1)
  })

  it('counts each branching construct', () => {
    const code = `function f(a: number) {
      if (a > 0) { return 1 }
      for (let i = 0; i < a; i++) {}
      while (a > 0) { a-- }
      return a > 1 ? 2 : 3
    }`
    // base 1 + if + for + while + conditional = 5
    expect(calculateCyclomaticComplexity(firstFunction(code))).toBe(5)
  })

  it('counts logical and nullish operators', () => {
    const code = 'function f(a: boolean, b: boolean, c: unknown) { return a && b || (c ?? a) }'
    // base 1 + && + || + ?? = 4
    expect(calculateCyclomaticComplexity(firstFunction(code))).toBe(4)
  })

  it('counts case and catch clauses', () => {
    const code = `function f(x: number) {
      try {
        switch (x) { case 1: return 1; case 2: return 2 }
      } catch (e) { return -1 }
      return 0
    }`
    // base 1 + case + case + catch = 4
    expect(calculateCyclomaticComplexity(firstFunction(code))).toBe(4)
  })
})

describe('calculateHalstead', () => {
  it('returns zero volume for an empty body', () => {
    const { volume, difficulty, effort } = calculateHalstead(firstFunction('function f() {}'))
    expect(volume).toBe(0)
    expect(difficulty).toBe(0)
    expect(effort).toBe(0)
  })

  it('produces positive volume/difficulty/effort for real code', () => {
    const { volume, difficulty, effort } = calculateHalstead(firstFunction('function f(a: number, b: number) { return a + b * a }'))
    expect(volume).toBeGreaterThan(0)
    expect(difficulty).toBeGreaterThan(0)
    expect(effort).toBeCloseTo(volume * difficulty, 6)
  })
})

describe('countSloc', () => {
  it('ignores blank lines and single-line comments', () => {
    const src = ['const a = 1', '', '// a comment', 'const b = 2'].join('\n')
    expect(countSloc(src)).toBe(2)
  })

  it('skips whole multi-line comment blocks', () => {
    const src = ['/*', ' comment', ' still comment', '*/', 'const a = 1'].join('\n')
    expect(countSloc(src)).toBe(1)
  })

  it('counts code sharing a line with the end of a block comment', () => {
    const src = ['/* start', 'mid */ const a = 1'].join('\n')
    expect(countSloc(src)).toBe(1)
  })

  it('counts code trailing a single-line block comment', () => {
    expect(countSloc('/* x */ const a = 1')).toBe(1)
  })
})

describe('calculateMaintainabilityIndex', () => {
  it('returns 100 when volume or sloc is zero', () => {
    expect(calculateMaintainabilityIndex(0, 5, 10)).toBe(100)
    expect(calculateMaintainabilityIndex(100, 5, 0)).toBe(100)
  })

  it('matches the MI formula for known inputs (within the 0-100 range)', () => {
    const expected = 171 - 5.2 * Math.log(1000) - 0.23 * 10 - 16.2 * Math.log(50)
    expect(expected).toBeGreaterThan(0)
    expect(expected).toBeLessThan(100)
    expect(calculateMaintainabilityIndex(1000, 10, 50)).toBeCloseTo(expected, 6)
  })

  it('clamps into the 0-100 range', () => {
    expect(calculateMaintainabilityIndex(1e6, 500, 5000)).toBe(0)
    expect(calculateMaintainabilityIndex(2, 1, 1)).toBe(100)
  })
})
