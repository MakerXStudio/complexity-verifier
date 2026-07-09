import fs from 'node:fs'

export type CommentBlockViolation = {
  file: string
  /** 1-based line where the block starts. */
  line: number
  /** Physical lines the block occupies. */
  lines: number
}

// context: `context:` is the deliberate escape hatch — a human/AI marks a comment as durable
// context (the "why") rather than implementation narration, and it is never flagged.
function isContextExempt(firstLine: string): boolean {
  const stripped = firstLine.replace(/^\s*(?:\/\/+|\/\*+|\*)\s*/, '')
  return stripped.toLowerCase().startsWith('context:')
}

function consumeBlockComment(
  file: string,
  lines: readonly string[],
  start: number,
  maxLines: number,
  out: CommentBlockViolation[],
): number {
  const isJsDoc = (lines[start] as string).trim().startsWith('/**')
  let end = start
  while (end < lines.length && !(lines[end] as string).includes('*/')) end++
  const last = Math.min(end, lines.length - 1)
  const count = last - start + 1
  if (!isJsDoc && !isContextExempt(lines[start] as string) && count > maxLines) {
    out.push({ file, line: start + 1, lines: count })
  }
  return last + 1
}

function consumeLineComments(
  file: string,
  lines: readonly string[],
  start: number,
  maxLines: number,
  out: CommentBlockViolation[],
): number {
  let end = start
  while (end < lines.length && (lines[end] as string).trim().startsWith('//')) end++
  const count = end - start
  if (!isContextExempt(lines[start] as string) && count > maxLines) {
    out.push({ file, line: start + 1, lines: count })
  }
  return end
}

function scanFile(file: string, content: string, maxLines: number, out: CommentBlockViolation[]): void {
  const lines = content.split('\n')
  let i = 0
  while (i < lines.length) {
    const trimmed = (lines[i] as string).trim()
    if (trimmed.startsWith('/*')) {
      i = consumeBlockComment(file, lines, i, maxLines, out)
    } else if (trimmed.startsWith('//')) {
      i = consumeLineComments(file, lines, i, maxLines, out)
    } else {
      i++
    }
  }
}

/** Flag comment blocks longer than `maxLines` in a single file's `content` (see {@link findLongCommentBlocks}). */
export function findLongCommentBlocksInContent(file: string, content: string, maxLines: number): CommentBlockViolation[] {
  const out: CommentBlockViolation[] = []
  scanFile(file, content, maxLines, out)
  return out
}

/**
 * Flag comment blocks longer than `maxLines`. A block is a run of consecutive whole-line `//`
 * comments or a `/* ... *\/` block comment. JSDoc (`/**`) blocks and blocks whose first line
 * starts with `context:` are exempt. Trailing/inline comments do not start a block.
 */
export function findLongCommentBlocks(files: readonly string[], maxLines: number): CommentBlockViolation[] {
  const out: CommentBlockViolation[] = []
  for (const file of files) {
    scanFile(file, fs.readFileSync(file, 'utf-8'), maxLines, out)
  }
  return out
}
