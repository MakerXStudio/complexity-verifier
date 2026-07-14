import { describe, expect, it } from 'vitest'

import { parseMaxWarnings } from './registerChecks.ts'

describe('parseMaxWarnings', () => {
  it('parses a non-negative integer', () => {
    expect(parseMaxWarnings('0')).toBe(0)
    expect(parseMaxWarnings('5')).toBe(5)
    expect(parseMaxWarnings(' 7 ')).toBe(7)
  })

  it('rejects a negative number', () => {
    expect(() => parseMaxWarnings('-1')).toThrow(/non-negative integer/)
  })

  it('rejects a non-integer', () => {
    expect(() => parseMaxWarnings('2.5')).toThrow(/non-negative integer/)
  })

  it('rejects a non-numeric value', () => {
    expect(() => parseMaxWarnings('abc')).toThrow(/non-negative integer/)
  })

  it('rejects an empty value', () => {
    expect(() => parseMaxWarnings('')).toThrow(/non-negative integer/)
  })
})
