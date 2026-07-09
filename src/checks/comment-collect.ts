import fs from 'node:fs'

import { type CommentBlockViolation, findLongCommentBlocksInContent } from '../comments.ts'
import { scanComments } from '../shared/comment-scan.ts'
import { parseDiffAddedLines, parseDiffRemovedLines } from '../shared/diff.ts'
import { gitDiffAgainstBase } from '../shared/git.ts'
import { commentSpan, isDiffExempt, looksLikeCommentLine, type NewComment, shouldScan, toSingleLine } from './comment-common.ts'
import type { FileCommentCounts } from './comment-heuristics.ts'

export type CommentCandidates = {
  /** Long comment blocks in scope. */
  blocks: CommentBlockViolation[]
  /** Non-exempt comments in scope (feeds narration + --block-all). */
  comments: NewComment[]
  /** Per-file line counts for the density gate. */
  perFile: Map<string, FileCommentCounts>
}

const isBlank = (line: string | undefined): boolean => (line ?? '').trim() === ''

const blockIntersects = (block: CommentBlockViolation, changed: ReadonlySet<number>): boolean => {
  for (let l = block.line; l < block.line + block.lines; l++) if (changed.has(l)) return true
  return false
}

const sortComments = (comments: NewComment[]): NewComment[] => comments.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

// context: scope `all` judges every comment in the matched files — the whole-codebase audit / prune surface.
export function gatherAllComments(files: readonly string[], maxLines: number): CommentCandidates {
  const blocks: CommentBlockViolation[] = []
  const comments: NewComment[] = []
  const perFile = new Map<string, FileCommentCounts>()
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    blocks.push(...findLongCommentBlocksInContent(file, content, maxLines))
    let commentLines = 0
    for (const c of scanComments(file, content)) {
      if (isDiffExempt(c.text)) continue
      commentLines += commentSpan(c.text)
      comments.push({ file, line: c.line, text: toSingleLine(c.text) })
    }
    const nonBlank = content.split('\n').filter((l) => !isBlank(l)).length
    perFile.set(file, { added: nonBlank, commentLines, removedComments: 0 })
  }
  return { blocks, comments: sortComments(comments), perFile }
}

// context: scope `diff` judges only comments touching changed lines (vs the diff base) — one pass feeds every gate.
export function gatherDiffComments(ignoreGlobs: readonly string[], maxLines: number): CommentCandidates {
  const diff = gitDiffAgainstBase()
  const added = parseDiffAddedLines(diff)
  const removedByFile = parseDiffRemovedLines(diff)
  const blocks: CommentBlockViolation[] = []
  const comments: NewComment[] = []
  const perFile = new Map<string, FileCommentCounts>()
  for (const [file, changed] of added) {
    if (!shouldScan(file, ignoreGlobs)) continue
    const content = fs.readFileSync(file, 'utf-8')
    const fileLines = content.split('\n')
    for (const block of findLongCommentBlocksInContent(file, content, maxLines)) {
      if (blockIntersects(block, changed)) blocks.push(block)
    }
    let commentLines = 0
    for (const c of scanComments(file, content)) {
      if (isDiffExempt(c.text)) continue
      const span = commentSpan(c.text)
      for (let l = c.line; l < c.line + span; l++) if (changed.has(l)) commentLines++
      if (changed.has(c.line)) comments.push({ file, line: c.line, text: toSingleLine(c.text) })
    }
    let addedNonBlank = 0
    for (const l of changed) if (!isBlank(fileLines[l - 1])) addedNonBlank++
    const removedComments = (removedByFile.get(file) ?? []).filter(looksLikeCommentLine).length
    perFile.set(file, { added: addedNonBlank, commentLines, removedComments })
  }
  return { blocks, comments: sortComments(comments), perFile }
}
