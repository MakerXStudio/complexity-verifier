import { describe, expect, it } from 'vitest'

import { countJscpdClones, withinBudget } from './maxWarnings.ts'

function clone(aName: string, aStart: number, aEnd: number, bName: string, bStart: number, bEnd: number) {
  return {
    firstFile: { name: aName, start: aStart, end: aEnd },
    secondFile: { name: bName, start: bStart, end: bEnd },
  }
}

describe('countJscpdClones', () => {
  it('reads the total clone count from statistics when duplicates lack range info', () => {
    const report = { duplicates: [{}, {}, {}], statistics: { total: { clones: 3 } } }
    expect(countJscpdClones(report)).toBe(3)
  })

  it('falls back to the duplicates array length when statistics are missing', () => {
    expect(countJscpdClones({ duplicates: [{}, {}] })).toBe(2)
  })

  it('counts disjoint clones as separate regions', () => {
    const report = { duplicates: [clone('a.ts', 1, 10, 'b.ts', 1, 10), clone('a.ts', 50, 60, 'c.ts', 1, 10)] }
    expect(countJscpdClones(report)).toBe(2)
  })

  it('merges clones reported over overlapping ranges into one region', () => {
    const report = { duplicates: [clone('a.ts', 100, 120, 'b.ts', 10, 30), clone('a.ts', 110, 130, 'b.ts', 20, 40)] }
    expect(countJscpdClones(report)).toBe(1)
  })

  it('merges the same pattern repeated across N files into one region', () => {
    const report = {
      duplicates: [clone('x.ts', 1, 20, 'y.ts', 1, 20), clone('x.ts', 1, 20, 'z.ts', 1, 20), clone('y.ts', 1, 20, 'z.ts', 1, 20)],
    }
    expect(countJscpdClones(report)).toBe(1)
  })

  it('does not merge clones in the same file at non-overlapping ranges', () => {
    const report = { duplicates: [clone('a.ts', 979, 986, 'a.ts', 1085, 1092), clone('a.ts', 1008, 1023, 'a.ts', 1101, 1115)] }
    expect(countJscpdClones(report)).toBe(2)
  })

  it('prefers the deduped region count over the raw statistics total', () => {
    const report = {
      duplicates: [clone('a.ts', 1, 20, 'b.ts', 1, 20), clone('a.ts', 5, 25, 'c.ts', 1, 20)],
      statistics: { total: { clones: 2 } },
    }
    expect(countJscpdClones(report)).toBe(1)
  })

  it('returns 0 for a clean report', () => {
    expect(countJscpdClones({ duplicates: [], statistics: { total: { clones: 0 } } })).toBe(0)
  })

  it('throws on an unrecognised shape rather than counting it as zero', () => {
    expect(() => countJscpdClones({})).toThrow(/unrecognised/)
    expect(() => countJscpdClones({ statistics: { total: {} } })).toThrow(/unrecognised/)
  })

  it('rejects a non-integer or negative clone count when there is no duplicates array', () => {
    expect(() => countJscpdClones({ statistics: { total: { clones: -1 } } })).toThrow(/unrecognised/)
    expect(() => countJscpdClones({ statistics: { total: { clones: 2.5 } } })).toThrow(/unrecognised/)
  })
})

describe('withinBudget', () => {
  it('passes when the count is at or below the budget (budget is inclusive)', () => {
    expect(withinBudget(3, 5)).toBe(true)
    expect(withinBudget(5, 5)).toBe(true)
  })

  it('fails when the count exceeds the budget', () => {
    expect(withinBudget(6, 5)).toBe(false)
  })

  it('treats a budget of 0 as zero tolerance', () => {
    expect(withinBudget(0, 0)).toBe(true)
    expect(withinBudget(1, 0)).toBe(false)
  })
})
