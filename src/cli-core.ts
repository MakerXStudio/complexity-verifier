import { analyzeComplexity, DEFAULT_IGNORE, DEFAULT_PATTERN, findLongCommentBlocks, findSourceFiles, resolvePattern } from './index.ts'
import { color, printCommentBlockReport, printFailure, printFileDetail, printMaintainabilityReport } from './report.ts'

export type CliArgs = {
  pattern?: string
  ignore: string[]
  threshold?: number
  maxCommentBlockLines?: number
  commentBlockPushback: boolean
  commentBlockWarn: boolean
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const ignore: string[] = []
  let pattern: string | undefined
  let threshold: number | undefined
  let maxCommentBlockLines: number | undefined
  let commentBlockPushback = false
  let commentBlockWarn = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--threshold') {
      threshold = Number(argv[++i])
    } else if (arg === '--ignore') {
      ignore.push(argv[++i] as string)
    } else if (arg === '--max-comment-block-lines') {
      maxCommentBlockLines = Number(argv[++i])
    } else if (arg === '--comment-block-pushback') {
      commentBlockPushback = true
    } else if (arg === '--comment-block-warn') {
      commentBlockWarn = true
    } else {
      pattern = arg
    }
  }
  return { pattern, ignore, threshold, maxCommentBlockLines, commentBlockPushback, commentBlockWarn }
}

/** Run the opt-in comment-block check, report any violations, and return whether it should fail the run. */
function checkCommentBlocks(files: readonly string[], args: CliArgs): boolean {
  if (args.maxCommentBlockLines === undefined) return false
  const violations = findLongCommentBlocks(files, args.maxCommentBlockLines)
  if (violations.length === 0) return false
  printCommentBlockReport(violations, args.maxCommentBlockLines, { pushback: args.commentBlockPushback, warn: args.commentBlockWarn })
  return !args.commentBlockWarn
}

/** Run the CLI against the given argv (already sliced of `node` + script). Returns the process exit code. */
export function run(argv: readonly string[]): number {
  const args = parseArgs(argv)
  const { pattern, ignore, threshold } = args
  const resolvedPattern = pattern ?? DEFAULT_PATTERN
  const files = findSourceFiles(resolvePattern(resolvedPattern), [...DEFAULT_IGNORE, ...ignore])

  if (files.length === 0) {
    console.log(color.yellow('No files found matching pattern'))
    return threshold !== undefined ? 1 : 0
  }
  if (files.length === 1) {
    printFileDetail(files[0] as string)
    return checkCommentBlocks(files, args) ? 1 : 0
  }

  const { results, failing } = analyzeComplexity({ pattern: resolvedPattern, ignore, threshold })
  printMaintainabilityReport(results, failing, threshold)
  const thresholdFailed = threshold !== undefined && failing.length > 0
  if (thresholdFailed) printFailure(failing, threshold)
  const commentFailed = checkCommentBlocks(files, args)
  return thresholdFailed || commentFailed ? 1 : 0
}
