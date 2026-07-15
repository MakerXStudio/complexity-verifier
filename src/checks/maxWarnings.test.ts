import { describe, expect, it } from 'vitest'

import { countJscpdClones, withinBudget } from './maxWarnings.ts'

describe('countJscpdClones', () => {
  it('reads the total clone count from statistics', () => {
    const report = { duplicates: [{}, {}, {}], statistics: { total: { clones: 3 } } }
    expect(countJscpdClones(report)).toBe(3)
  })

  it('falls back to the duplicates array length when statistics are missing', () => {
    expect(countJscpdClones({ duplicates: [{}, {}] })).toBe(2)
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
