import { describe, expect, it } from 'vitest'

import { type CliArgs, parseArgs } from './cli-core.ts'

const DEFAULTS: CliArgs = {
  pattern: undefined,
  ignore: [],
  threshold: undefined,
  maxCommentBlockLines: undefined,
  commentBlockPushback: false,
  commentBlockWarn: false,
}

describe('parseArgs', () => {
  it('parses a positional pattern', () => {
    expect(parseArgs(['src/**/*.ts'])).toEqual({ ...DEFAULTS, pattern: 'src/**/*.ts' })
  })

  it('parses --threshold as a number', () => {
    expect(parseArgs(['--threshold', '50'])).toEqual({ ...DEFAULTS, threshold: 50 })
  })

  it('accumulates repeated --ignore flags', () => {
    const { ignore } = parseArgs(['--ignore', '**/a.ts', '--ignore', '**/b.ts'])
    expect(ignore).toEqual(['**/a.ts', '**/b.ts'])
  })

  it('parses a full combination of args', () => {
    expect(parseArgs(['src/**/*.ts', '--threshold', '60', '--ignore', '**/gen.ts'])).toEqual({
      ...DEFAULTS,
      pattern: 'src/**/*.ts',
      ignore: ['**/gen.ts'],
      threshold: 60,
    })
  })

  it('keeps the last positional when several are given', () => {
    expect(parseArgs(['first', 'second']).pattern).toBe('second')
  })

  it('parses --max-comment-block-lines as a number', () => {
    expect(parseArgs(['--max-comment-block-lines', '2']).maxCommentBlockLines).toBe(2)
  })

  it('parses the comment-block boolean flags', () => {
    const { commentBlockPushback, commentBlockWarn } = parseArgs(['--comment-block-pushback', '--comment-block-warn'])
    expect(commentBlockPushback).toBe(true)
    expect(commentBlockWarn).toBe(true)
  })

  it('parses comment-block flags alongside the existing flags', () => {
    expect(parseArgs(['src/**/*.ts', '--threshold', '50', '--max-comment-block-lines', '3', '--comment-block-pushback'])).toEqual({
      ...DEFAULTS,
      pattern: 'src/**/*.ts',
      threshold: 50,
      maxCommentBlockLines: 3,
      commentBlockPushback: true,
    })
  })
})
