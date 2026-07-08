export {
  type AnalyzeOptions,
  type AnalyzeResult,
  analyzeComplexity,
  DEFAULT_IGNORE,
  DEFAULT_PATTERN,
  type FileScore,
  findSourceFiles,
  resolvePattern,
  scoreFiles,
} from './analyze.ts'
export { runBlockComments } from './checks/block-comments.ts'
export { runCommentBlock } from './checks/comment-block.ts'
export { runComplexity } from './checks/complexity.ts'
export { runForbiddenStrings } from './checks/forbidden-strings.ts'
export { runHardcodedColors } from './checks/hardcoded-colors.ts'
export { CHECKS, defaultChecks, getCheck } from './checks/registry.ts'
export type { Check, CheckKind, CheckResult } from './checks/types.ts'
export { type CommentBlockViolation, findLongCommentBlocks } from './comments.ts'
export { type FunctionCallback, forEachFunction } from './functions.ts'
export {
  calculateCyclomaticComplexity,
  calculateHalstead,
  calculateMaintainabilityIndex,
  countSloc,
  type HalsteadMetrics,
} from './metrics.ts'
export { orchestrate } from './orchestrator/run.ts'
export { runDefaults } from './orchestrator/runDefaults.ts'
export { applyInit, type InitOptions, type InitResult } from './scaffold/init.ts'
export { type ForbiddenStringsRule, loadVerifyConfig, type VerifyConfig } from './shared/config.ts'
