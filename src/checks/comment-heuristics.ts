import { isCommentExempt, type NewComment } from './comment-common.ts'

// context: session narration — comments that describe the editing act or restate *what* the next line does,
// rather than durable *why*. These are the highest-signal tell that an agent is thinking out loud in comments.
const NARRATION_PATTERNS: RegExp[] = [
  /\blet me\b/i,
  /\bas requested\b/i,
  /\bas (?:you |we )?(?:asked|mentioned|discussed)\b/i,
  /\bnow (?:i(?:'| a| wi)ll|i'm|we(?:'ll| will)|let(?:'s| us))\b/i,
  /\bhere(?:'s| is| we)\b/i,
  /\bfirst,|\bnext,|\bthen,|\bfinally,/i,
  /\bthis (?:function|method|code|line|block|file|class|helper) (?:does|will|is|handles|returns|creates|adds|sets|gets)\b/i,
  /\bthe following\b/i,
  /\b(?:added|adding|updated|updating|changed|changing|removed|removing|refactored|fixed) (?:the|this|a|to|so|because|for)\b/i,
  /\b(?:step \d|todo:|fixme:)/i,
]

// context: em-dash and curly quotes are high-precision LLM tells — models emit them freely.
const LLM_PUNCT_TELL = /[—‘’“”]/

export type DensityViolation = {
  file: string
  /** Added lines in the changed file. */
  added: number
  /** Added lines that fall inside a non-exempt comment. */
  commentLines: number
  /** commentLines / added, 0–1. */
  ratio: number
}

/** From comments in scope, return those whose text reads as session narration or carries an LLM punctuation tell. */
export function findNarrationComments(comments: readonly NewComment[], contextOverride = true): NewComment[] {
  return comments.filter(
    (c) => !isCommentExempt(c.text, contextOverride) && (NARRATION_PATTERNS.some((re) => re.test(c.text)) || LLM_PUNCT_TELL.test(c.text)),
  )
}

export type FileCommentCounts = {
  /** Non-blank lines in scope (added non-blank lines for diff scope; non-blank file lines for `all`). */
  added: number
  /** Lines in scope that fall inside a non-exempt comment. */
  commentLines: number
  /** Comment lines the change removed — the density gate skips a net comment *trim* (diff scope only; 0 for `all`). */
  removedComments: number
}

/**
 * Flag files where non-exempt comments make up too large a share of the lines in scope. Files with fewer than
 * `minAddedLines` lines are skipped (tiny diffs never trip the gate), as is any change that removes at least as
 * many comment lines as it adds — a net trim cannot be adding bloat.
 */
export function findCommentDensity(
  perFile: ReadonlyMap<string, FileCommentCounts>,
  opts: { threshold: number; minAddedLines: number },
): DensityViolation[] {
  const out: DensityViolation[] = []
  for (const [file, { added, commentLines, removedComments }] of perFile) {
    if (added < opts.minAddedLines) continue
    if (commentLines <= removedComments) continue
    const ratio = added === 0 ? 0 : commentLines / added
    if (ratio >= opts.threshold) out.push({ file, added, commentLines, ratio })
  }
  out.sort((a, b) => b.ratio - a.ratio || a.file.localeCompare(b.file))
  return out
}
