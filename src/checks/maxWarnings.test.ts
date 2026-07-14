import { describe, expect, it } from 'vitest'

import { countJscpdClones, countKnipFindings, withinBudget } from './maxWarnings.ts'

describe('countKnipFindings', () => {
  it('sums the lengths of every finding array across all issue rows', () => {
    const report = {
      issues: [
        { file: 'src/unused.ts', files: ['src/unused.ts'], exports: [], dependencies: [] },
        {
          file: 'src/foo.ts',
          exports: [{ name: 'a' }, { name: 'b' }],
          types: [{ name: 'T' }],
          duplicates: [[{ name: 'x' }, { name: 'y' }]],
        },
        { file: 'package.json', dependencies: [{ name: 'lodash' }], devDependencies: [{ name: 'jest' }], unlisted: [{ name: 'react' }] },
      ],
    }
    expect(countKnipFindings(report)).toBe(8)
  })

  it('excludes the file string and owners metadata from the count', () => {
    const report = { issues: [{ file: 'src/foo.ts', owners: [{ name: 'team-a' }, { name: 'team-b' }], exports: [{ name: 'unused' }] }] }
    expect(countKnipFindings(report)).toBe(1)
  })

  it('returns 0 for a clean report', () => {
    expect(countKnipFindings({ issues: [] })).toBe(0)
  })

  it('returns 0 when the issues key is absent', () => {
    expect(countKnipFindings({})).toBe(0)
  })
})

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
