import { describe, expect, it } from 'vitest'

import { parseArgs } from './cli-core.ts'

describe('parseArgs', () => {
  it('parses a positional pattern', () => {
    expect(parseArgs(['src/**/*.ts'])).toEqual({ pattern: 'src/**/*.ts', ignore: [], threshold: undefined })
  })

  it('parses --threshold as a number', () => {
    expect(parseArgs(['--threshold', '50'])).toEqual({ pattern: undefined, ignore: [], threshold: 50 })
  })

  it('accumulates repeated --ignore flags', () => {
    const { ignore } = parseArgs(['--ignore', '**/a.ts', '--ignore', '**/b.ts'])
    expect(ignore).toEqual(['**/a.ts', '**/b.ts'])
  })

  it('parses a full combination of args', () => {
    expect(parseArgs(['src/**/*.ts', '--threshold', '60', '--ignore', '**/gen.ts'])).toEqual({
      pattern: 'src/**/*.ts',
      ignore: ['**/gen.ts'],
      threshold: 60,
    })
  })

  it('keeps the last positional when several are given', () => {
    expect(parseArgs(['first', 'second']).pattern).toBe('second')
  })
})
