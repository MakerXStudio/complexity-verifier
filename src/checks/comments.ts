import { DEFAULT_IGNORE, DEFAULT_PATTERN, findSourceFiles, resolvePattern } from '../analyze.ts'
import { findLongCommentBlocks } from '../comments.ts'
import { printCommentBlockReport, printCommentDensityReport, printNarrationReport } from '../report.ts'
import { color } from '../shared/color.ts'
import { scanFileComments } from '../shared/comment-scan.ts'
import { loadVerifyConfig } from '../shared/config.ts'
import { parseDiffAddedLines } from '../shared/diff.ts'
import { gitDiffAgainstBase } from '../shared/git.ts'
import { commentSpan, isDiffExempt, type NewComment, shouldScan, toSingleLine } from './comment-common.ts'
import { type FileCommentCounts, findCommentDensity, findNarrationComments } from './comment-heuristics.ts'
import type { CheckResult } from './types.ts'

const DEFAULT_MAX_COMMENT_BLOCK_LINES = 2
const DEFAULT_DENSITY_THRESHOLD = 0.3
const DEFAULT_MIN_ADDED_LINES = 10

type ChangedComments = {
  /** Non-exempt comments whose first line sits on a changed line (block-new-comments + narration). */
  comments: NewComment[]
  /** Per changed file: added-line count and how many of them fall inside a non-exempt comment (density). */
  perFile: Map<string, FileCommentCounts>
}

// context: one pass over the diff feeds every diff-based gate (block-new-comments, narration, density) so we
// scan each changed file's comments only once.
function collectChangedLineComments(ignoreGlobs: readonly string[]): ChangedComments {
  const added = parseDiffAddedLines(gitDiffAgainstBase())
  const comments: NewComment[] = []
  const perFile = new Map<string, FileCommentCounts>()
  for (const [file, lines] of added) {
    if (!shouldScan(file, ignoreGlobs)) continue
    let commentLines = 0
    for (const comment of scanFileComments(file)) {
      if (isDiffExempt(comment.text)) continue
      const span = commentSpan(comment.text)
      for (let l = comment.line; l < comment.line + span; l++) if (lines.has(l)) commentLines++
      if (lines.has(comment.line)) comments.push({ file, line: comment.line, text: toSingleLine(comment.text) })
    }
    perFile.set(file, { added: lines.size, commentLines })
  }
  comments.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
  return { comments, perFile }
}

function reportCommentsOnChangedLines(findings: readonly NewComment[]): void {
  console.error(color.red('\nComments on changed lines:\n'))
  for (const { file, line, text } of findings) console.error(`  ${file}:${line} → ${text}`)
  console.error(color.red(`\nTotal: ${findings.length} comment(s)`))
  console.error(
    '\nWith --block-new-comments, every comment on a changed line fails this gate, whether you added or edited it. Remove them and let the code document itself.',
  )
}

export type CommentsOptions = {
  pattern?: string
  ignore?: readonly string[]
  maxLines?: number
  pushback?: boolean
  warn?: boolean
  /** Also fail on any comment on a line changed against the diff base (machine directives / context: exempt). */
  blockNewComments?: boolean
  /** Flag session-narration comments on changed lines. Default true. */
  narration?: boolean
  /** Fail files whose changed-line comment share reaches this ratio (0–1). `false`/`0` disables. Default 0.3. */
  density?: number | false
  /** Minimum added lines before density applies. Default 10. */
  minAddedLines?: number
}

function resolveDensity(opt: number | false | undefined, cfg: number | false | undefined): number {
  const value = opt ?? cfg ?? DEFAULT_DENSITY_THRESHOLD
  return value === false ? 0 : value
}

function runChangedLineGates(opts: CommentsOptions): boolean {
  const cfg = loadVerifyConfig().comments ?? {}
  const ignoreGlobs = opts.ignore?.length ? opts.ignore : (cfg.ignore ?? [])
  const narrationOn = !opts.blockNewComments && (opts.narration ?? cfg.narration ?? true)
  const densityThreshold = opts.blockNewComments ? 0 : resolveDensity(opts.density, cfg.density)
  const minAddedLines = opts.minAddedLines ?? cfg.minAddedLines ?? DEFAULT_MIN_ADDED_LINES

  if (!opts.blockNewComments && !narrationOn && densityThreshold === 0) return true

  const { comments, perFile } = collectChangedLineComments(ignoreGlobs)
  let ok = true

  // context: --block-new-comments is the strictest gate (every new comment fails), so it subsumes the narration
  // and density heuristics; when it's on we run it alone.
  if (opts.blockNewComments) {
    if (comments.length === 0) {
      console.log(color.green('No comments on changed lines.'))
    } else {
      reportCommentsOnChangedLines(comments)
      ok = false
    }
    return ok
  }

  if (narrationOn) {
    const narration = findNarrationComments(comments)
    if (narration.length === 0) {
      console.log(color.green('No narration comments on changed lines.'))
    } else {
      printNarrationReport(narration, { pushback: !!opts.pushback })
      ok = false
    }
  }

  if (densityThreshold > 0) {
    const dense = findCommentDensity(perFile, { threshold: densityThreshold, minAddedLines })
    if (dense.length === 0) {
      console.log(color.green('Comment density within threshold.'))
    } else {
      printCommentDensityReport(dense, { threshold: densityThreshold, pushback: !!opts.pushback })
      ok = false
    }
  }

  return ok
}

/**
 * Native check: flag comment blocks longer than `maxLines` (JSDoc and `context:`-prefixed blocks exempt), plus
 * diff-scoped heuristics on changed lines — session narration and comment density (both on by default). With
 * `blockNewComments`, instead fail on any comment on a changed line (the strictest gate).
 */
export function runComments(opts: CommentsOptions = {}): CheckResult {
  const maxLines = opts.maxLines ?? DEFAULT_MAX_COMMENT_BLOCK_LINES
  const pattern = opts.pattern ?? DEFAULT_PATTERN
  const files = findSourceFiles(resolvePattern(pattern), [...DEFAULT_IGNORE, ...(opts.ignore ?? [])])

  const blocks = findLongCommentBlocks(files, maxLines)
  let blocksOk = true
  if (blocks.length === 0) {
    console.log(color.green(`No comment block over ${maxLines} line(s)`))
  } else {
    printCommentBlockReport(blocks, maxLines, { pushback: !!opts.pushback, warn: !!opts.warn })
    blocksOk = !!opts.warn
  }

  const changedLinesOk = runChangedLineGates(opts)

  return { name: 'comments', ok: blocksOk && changedLinesOk }
}
