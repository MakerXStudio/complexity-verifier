import { commentSpan, isDiffExempt, type NewComment, toSingleLine } from '../checks/comment-common.ts'
import { type DensityViolation, findCommentDensity, findNarrationComments } from '../checks/comment-heuristics.ts'
import { type CommentBlockViolation, findLongCommentBlocksInContent } from '../comments.ts'
import { PUSHBACK } from '../report.ts'
import { scanComments } from '../shared/comment-scan.ts'
import type { HookTarget } from './payload.ts'

export type HookOptions = { maxLines: number; narration: boolean; density: number; minAddedLines: number; blockAll: boolean }

export type HookFindings = {
  file: string
  /** Every non-exempt comment the edit added — populated only under blockAll. */
  all: NewComment[]
  blocks: CommentBlockViolation[]
  narration: NewComment[]
  density: DensityViolation | null
}

export function hasFindings(f: HookFindings): boolean {
  return f.all.length > 0 || f.blocks.length > 0 || f.narration.length > 0 || f.density !== null
}

/**
 * Apply the comment gates to the text a single edit introduced. Every comment in `addedText` is treated as new,
 * so there is no diff — the fragment itself is the change (always diff-scoped). JSDoc and `context:` are exempt.
 */
export function analyzeAddedComments(target: HookTarget, opts: HookOptions): HookFindings {
  const fresh: NewComment[] = scanComments(target.file, target.addedText)
    .filter((c) => !isDiffExempt(c.text))
    .map((c) => ({ file: target.file, line: c.line, text: toSingleLine(c.text) }))

  if (opts.blockAll) return { file: target.file, all: fresh, blocks: [], narration: [], density: null }

  const blocks = opts.maxLines > 0 ? findLongCommentBlocksInContent(target.file, target.addedText, opts.maxLines) : []
  const narration = opts.narration ? findNarrationComments(fresh) : []

  let density: DensityViolation | null = null
  if (opts.density > 0) {
    const added = target.addedText.split('\n').filter((l) => l.trim() !== '').length
    const commentLines = scanComments(target.file, target.addedText)
      .filter((c) => !isDiffExempt(c.text))
      .reduce((n, c) => n + commentSpan(c.text), 0)
    const perFile = new Map([[target.file, { added, commentLines: Math.min(commentLines, added), removedComments: 0 }]])
    density = findCommentDensity(perFile, { threshold: opts.density, minAddedLines: opts.minAddedLines })[0] ?? null
  }

  return { file: target.file, all: [], blocks, narration, density }
}

/** Build the stderr feedback an edit-time hook returns to the agent when it wrote low-value comments. */
export function formatHookFeedback(f: HookFindings): string {
  const parts: string[] = [`Low-value comments in your edit to ${f.file}:`]
  for (const c of f.all) parts.push(`  • comment (--block-all): "${c.text}"`)
  for (const b of f.blocks)
    parts.push(`  • ${b.lines}-line comment block near line ${b.line} — too long; comments should explain *why*, not narrate *what*.`)
  for (const n of f.narration) parts.push(`  • narration comment: "${n.text}"`)
  if (f.density)
    parts.push(`  • ${Math.round(f.density.ratio * 100)}% of the edit is comments (${f.density.commentLines}/${f.density.added} lines).`)
  return parts.join('\n') + PUSHBACK
}
