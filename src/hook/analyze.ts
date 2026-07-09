import { commentSpan, isDiffExempt, type NewComment, toSingleLine } from '../checks/comment-common.ts'
import { type DensityViolation, findCommentDensity, findNarrationComments } from '../checks/comment-heuristics.ts'
import { type CommentBlockViolation, findLongCommentBlocksInContent } from '../comments.ts'
import { scanComments } from '../shared/comment-scan.ts'
import type { HookTarget } from './payload.ts'

export type HookOptions = { maxLines: number; narration: boolean; density: number; minAddedLines: number }

export type HookFindings = {
  file: string
  blocks: CommentBlockViolation[]
  narration: NewComment[]
  density: DensityViolation | null
}

export function hasFindings(f: HookFindings): boolean {
  return f.blocks.length > 0 || f.narration.length > 0 || f.density !== null
}

/**
 * Apply the comment gates to the text a single edit introduced. Every comment in `addedText` is treated as new,
 * so there is no diff — the fragment itself is the change. JSDoc and `context:` comments are exempt throughout.
 */
export function analyzeAddedComments(target: HookTarget, opts: HookOptions): HookFindings {
  const scanned = scanComments(target.file, target.addedText)
  const fresh: NewComment[] = scanned
    .filter((c) => !isDiffExempt(c.text))
    .map((c) => ({ file: target.file, line: c.line, text: toSingleLine(c.text) }))

  const blocks = opts.maxLines > 0 ? findLongCommentBlocksInContent(target.file, target.addedText, opts.maxLines) : []
  const narration = opts.narration ? findNarrationComments(fresh) : []

  let density: DensityViolation | null = null
  if (opts.density > 0) {
    const added = target.addedText.split('\n').length
    const commentLines = scanned.filter((c) => !isDiffExempt(c.text)).reduce((n, c) => n + commentSpan(c.text), 0)
    const perFile = new Map([[target.file, { added, commentLines: Math.min(commentLines, added) }]])
    density = findCommentDensity(perFile, { threshold: opts.density, minAddedLines: opts.minAddedLines })[0] ?? null
  }

  return { file: target.file, blocks, narration, density }
}

const HOOK_PUSHBACK =
  'Fix this now, in this edit, before moving on. The ONLY sanctioned way to keep a flagged comment is to prefix its first line with `context:`, which pages a human to approve it — do not do that unless the comment is genuinely durable context the code cannot express. Otherwise delete it and let the code document itself. Do NOT weaken or remove the check.'

/** Build the stderr feedback an edit-time hook returns to the agent when it wrote low-value comments. */
export function formatHookFeedback(f: HookFindings): string {
  const parts: string[] = [`Low-value comments in your edit to ${f.file}:`]
  for (const b of f.blocks)
    parts.push(`  • ${b.lines}-line comment block near line ${b.line} — too long; comments should explain *why*, not narrate *what*.`)
  for (const n of f.narration) parts.push(`  • narration comment: "${n.text}"`)
  if (f.density)
    parts.push(`  • ${Math.round(f.density.ratio * 100)}% of the edit is comments (${f.density.commentLines}/${f.density.added} lines).`)
  parts.push('', HOOK_PUSHBACK)
  return parts.join('\n')
}
