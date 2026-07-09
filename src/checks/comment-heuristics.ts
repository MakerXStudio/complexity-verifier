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

export type DensityViolation = {
  file: string
  /** Added lines in the changed file. */
  added: number
  /** Added lines that fall inside a non-exempt comment. */
  commentLines: number
  /** commentLines / added, 0–1. */
  ratio: number
}

/** From comments already scoped to changed lines, return those whose text reads as session narration. */
export function findNarrationComments(comments: readonly NewComment[]): NewComment[] {
  return comments.filter((c) => !isCommentExempt(c.text) && NARRATION_PATTERNS.some((re) => re.test(c.text)))
}

export type FileCommentCounts = { added: number; commentLines: number }

/**
 * Flag files where non-exempt comments make up too large a share of the added lines. Only files with at least
 * `minAddedLines` added lines are considered, so tiny diffs never trip the gate.
 */
export function findCommentDensity(
  perFile: ReadonlyMap<string, FileCommentCounts>,
  opts: { threshold: number; minAddedLines: number },
): DensityViolation[] {
  const out: DensityViolation[] = []
  for (const [file, { added, commentLines }] of perFile) {
    if (added < opts.minAddedLines) continue
    const ratio = added === 0 ? 0 : commentLines / added
    if (ratio >= opts.threshold) out.push({ file, added, commentLines, ratio })
  }
  out.sort((a, b) => b.ratio - a.ratio || a.file.localeCompare(b.file))
  return out
}
