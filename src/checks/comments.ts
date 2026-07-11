import { DEFAULT_IGNORE, DEFAULT_PATTERN, findSourceFiles, resolvePattern } from '../analyze.ts'
import {
  type CommentScope,
  printBlockAllReport,
  printCommentBlockReport,
  printCommentDensityReport,
  printNarrationReport,
} from '../report.ts'
import { color } from '../shared/color.ts'
import { loadVerifyConfig } from '../shared/config.ts'
import { type CommentCandidates, gatherAllComments, gatherDiffComments } from './comment-collect.ts'
import { findCommentDensity, findNarrationComments } from './comment-heuristics.ts'
import type { CheckResult } from './types.ts'

const DEFAULT_MAX_COMMENT_BLOCK_LINES = 2
const DEFAULT_DENSITY_THRESHOLD = 0.3
const DEFAULT_MIN_ADDED_LINES = 10

export type CommentsOptions = {
  pattern?: string
  ignore?: readonly string[]
  maxLines?: number
  pushback?: boolean
  warn?: boolean
  /** Which comments the gates judge. Default `diff` (changed lines); `all` scans whole files. */
  scope?: CommentScope
  /** Fail every non-exempt comment in scope, not just heuristic hits. */
  blockAll?: boolean
  /** Back-compat alias for `scope: 'diff'` + `blockAll: true`. */
  blockNewComments?: boolean
  /** Flag session-narration comments. Default true. */
  narration?: boolean
  /** Comment-density ratio (0–1) that fails a file; `false`/`0` disables. Default 0.3. */
  density?: number | false
  /** Minimum lines in scope before density applies. Default 10. */
  minAddedLines?: number
  /** Treat `context:`-prefixed comments as exempt. Default true; set false for a stricter gate / cleanup. */
  contextOverride?: boolean
}

function resolveDensity(opt: number | false | undefined, cfg: number | false | undefined): number {
  const value = opt ?? cfg ?? DEFAULT_DENSITY_THRESHOLD
  return value === false ? 0 : value
}

const whereText = (scope: CommentScope): string => (scope === 'all' ? 'in the codebase' : 'on changed lines')

function gather(
  opts: CommentsOptions,
  scope: CommentScope,
  ignoreGlobs: readonly string[],
  maxLines: number,
  contextOverride: boolean,
): CommentCandidates {
  if (scope === 'all') {
    const files = findSourceFiles(resolvePattern(opts.pattern ?? DEFAULT_PATTERN), [...DEFAULT_IGNORE, ...ignoreGlobs])
    return gatherAllComments(files, maxLines, contextOverride)
  }
  return gatherDiffComments(ignoreGlobs, maxLines, contextOverride)
}

/**
 * Native check for low-value comments across two orthogonal axes: **scope** (`diff` — only comments on changed
 * lines, the default; or `all` — every comment in the matched files) and **strictness** (heuristics by default —
 * long blocks, session narration, comment density; or `blockAll`, which fails every comment in scope). JSDoc,
 * `context:` blocks, and machine directives are always exempt.
 */
export function runComments(opts: CommentsOptions = {}): CheckResult {
  const cfg = loadVerifyConfig().comments ?? {}
  const maxLines = opts.maxLines ?? DEFAULT_MAX_COMMENT_BLOCK_LINES
  const ignoreGlobs = opts.ignore?.length ? opts.ignore : (cfg.ignore ?? [])
  const scope: CommentScope = opts.scope ?? (opts.blockNewComments ? 'diff' : undefined) ?? cfg.scope ?? 'diff'
  const blockAll = opts.blockAll ?? opts.blockNewComments ?? cfg.blockAll ?? false
  const narrationOn = !blockAll && (opts.narration ?? cfg.narration ?? true)
  const densityThreshold = blockAll ? 0 : resolveDensity(opts.density, cfg.density)
  const minAddedLines = opts.minAddedLines ?? cfg.minAddedLines ?? DEFAULT_MIN_ADDED_LINES
  const contextOverride = opts.contextOverride ?? cfg.contextOverride ?? true
  const pushback = !!opts.pushback

  const candidates = gather(opts, scope, ignoreGlobs, maxLines, contextOverride)

  if (blockAll) {
    if (candidates.comments.length === 0) {
      console.log(color.green(`No comments ${whereText(scope)}.`))
      return { name: 'comments', ok: true }
    }
    printBlockAllReport(candidates.comments, { scope, pushback, contextOverride })
    return { name: 'comments', ok: false }
  }

  let ok = true
  ok = reportBlocks(candidates, maxLines, { pushback, warn: !!opts.warn, contextOverride }) && ok
  if (narrationOn) ok = reportNarration(candidates, scope, pushback, contextOverride) && ok
  if (densityThreshold > 0)
    ok = reportDensity(candidates, { scope, pushback, contextOverride, threshold: densityThreshold, minAddedLines }) && ok
  return { name: 'comments', ok }
}

function reportBlocks(
  candidates: CommentCandidates,
  maxLines: number,
  opts: { pushback: boolean; warn: boolean; contextOverride: boolean },
): boolean {
  if (candidates.blocks.length === 0) {
    console.log(color.green(`No comment block over ${maxLines} line(s)`))
    return true
  }
  printCommentBlockReport(candidates.blocks, maxLines, opts)
  return opts.warn
}

function reportNarration(candidates: CommentCandidates, scope: CommentScope, pushback: boolean, contextOverride: boolean): boolean {
  const narration = findNarrationComments(candidates.comments, contextOverride)
  if (narration.length === 0) {
    console.log(color.green(`No narration comments ${whereText(scope)}.`))
    return true
  }
  printNarrationReport(narration, { scope, pushback, contextOverride })
  return false
}

function reportDensity(
  candidates: CommentCandidates,
  opts: { scope: CommentScope; pushback: boolean; contextOverride: boolean; threshold: number; minAddedLines: number },
): boolean {
  const dense = findCommentDensity(candidates.perFile, { threshold: opts.threshold, minAddedLines: opts.minAddedLines })
  if (dense.length === 0) {
    console.log(color.green('Comment density within threshold.'))
    return true
  }
  printCommentDensityReport(dense, {
    threshold: opts.threshold,
    scope: opts.scope,
    pushback: opts.pushback,
    contextOverride: opts.contextOverride,
  })
  return false
}
