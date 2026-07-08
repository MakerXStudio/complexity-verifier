import { DEFAULT_IGNORE, DEFAULT_PATTERN, findSourceFiles, resolvePattern } from '../analyze.ts'
import { findLongCommentBlocks } from '../comments.ts'
import { printCommentBlockReport } from '../report.ts'
import { color } from '../shared/color.ts'
import type { CheckResult } from './types.ts'

export const DEFAULT_MAX_COMMENT_BLOCK_LINES = 2

export type CommentBlockOptions = {
  pattern?: string
  ignore?: readonly string[]
  maxLines?: number
  pushback?: boolean
  warn?: boolean
}

/** Native check: flag comment blocks longer than `maxLines`. JSDoc and `context:`-prefixed blocks are exempt. */
export function runCommentBlock(opts: CommentBlockOptions = {}): CheckResult {
  const maxLines = opts.maxLines ?? DEFAULT_MAX_COMMENT_BLOCK_LINES
  const pattern = opts.pattern ?? DEFAULT_PATTERN
  const files = findSourceFiles(resolvePattern(pattern), [...DEFAULT_IGNORE, ...(opts.ignore ?? [])])

  const violations = findLongCommentBlocks(files, maxLines)
  if (violations.length === 0) {
    console.log(color.green(`No comment block over ${maxLines} line(s)`))
    return { name: 'comment-block', ok: true }
  }

  printCommentBlockReport(violations, maxLines, { pushback: !!opts.pushback, warn: !!opts.warn })
  return { name: 'comment-block', ok: !!opts.warn }
}
