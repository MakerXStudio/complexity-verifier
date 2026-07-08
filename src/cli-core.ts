import { analyzeComplexity, DEFAULT_IGNORE, DEFAULT_PATTERN, findSourceFiles, resolvePattern } from './index.ts'
import { color, printFailure, printFileDetail, printMaintainabilityReport } from './report.ts'

export type CliArgs = {
  pattern?: string
  ignore: string[]
  threshold?: number
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const ignore: string[] = []
  let pattern: string | undefined
  let threshold: number | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--threshold') {
      threshold = Number(argv[++i])
    } else if (arg === '--ignore') {
      ignore.push(argv[++i] as string)
    } else {
      pattern = arg
    }
  }
  return { pattern, ignore, threshold }
}

/** Run the CLI against the given argv (already sliced of `node` + script). Returns the process exit code. */
export function run(argv: readonly string[]): number {
  const { pattern, ignore, threshold } = parseArgs(argv)
  const resolvedPattern = pattern ?? DEFAULT_PATTERN
  const files = findSourceFiles(resolvePattern(resolvedPattern), [...DEFAULT_IGNORE, ...ignore])

  if (files.length === 0) {
    console.log(color.yellow('No files found matching pattern'))
    return threshold !== undefined ? 1 : 0
  }
  if (files.length === 1) {
    printFileDetail(files[0] as string)
    return 0
  }

  const { results, failing } = analyzeComplexity({ pattern: resolvedPattern, ignore, threshold })
  printMaintainabilityReport(results, failing, threshold)
  if (threshold !== undefined && failing.length > 0) {
    printFailure(failing, threshold)
    return 1
  }
  return 0
}
