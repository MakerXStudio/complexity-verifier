import { runBlockComments } from './block-comments.ts'
import { runCommentBlock } from './comment-block.ts'
import { runComplexity } from './complexity.ts'
import { defineExternalCheck } from './external.ts'
import { runForbiddenStrings } from './forbidden-strings.ts'
import { runHardcodedColors } from './hardcoded-colors.ts'
import type { Check, CheckResult } from './types.ts'

function nativeCheck(name: string, description: string, inDefaultRun: boolean, run: () => CheckResult): Check {
  return {
    name,
    description,
    kind: 'native',
    inDefaultRun,
    // Native checks scaffold as a call back into this CLI's own subcommand.
    scaffold: { script: `verify ${name}` },
    runDefault: async () => run(),
  }
}

/** Every verification this package knows about. Order here is the order shown by `verify list`. */
export const CHECKS: Check[] = [
  nativeCheck('complexity', 'Maintainability-index gate (cyclomatic + Halstead + SLOC)', true, () => runComplexity()),
  nativeCheck('comment-block', 'Flag comment blocks longer than the limit (JSDoc / context: exempt)', true, () => runCommentBlock()),
  nativeCheck('block-comments', 'Fail on any comment added to a line changed against HEAD', true, () => runBlockComments()),
  nativeCheck('hardcoded-colors', 'Fail on literal hex / 0x colour values in source', true, () => runHardcodedColors()),
  nativeCheck('forbidden-strings', 'Fail on disallowed JSON config values (rules from verify config)', true, () => runForbiddenStrings()),
  defineExternalCheck({
    name: 'knip',
    description: 'Unused files, exports and dependencies',
    bin: 'knip',
    command: 'knip --no-progress --treat-config-hints-as-errors',
    devDeps: ['knip'],
  }),
  defineExternalCheck({
    name: 'circular-deps',
    description: 'Circular dependency detection (skott)',
    bin: 'skott',
    command: 'skott --displayMode=raw --showCircularDependencies --exitCodeOnCircularDependencies=1',
    devDeps: ['skott'],
  }),
  defineExternalCheck({
    name: 'duplicate-code',
    description: 'Copy-paste detection (jscpd)',
    bin: 'jscpd',
    command: 'jscpd --format typescript,tsx --exit-code 1 --ignore "**/*.test.*" -r consoleFull src',
    devDeps: ['jscpd'],
  }),
  defineExternalCheck({
    name: 'lint',
    description: 'Lint + autofix (oxlint)',
    bin: 'oxlint',
    command: 'oxlint --fix .',
    devDeps: ['oxlint'],
  }),
]

export function getCheck(name: string): Check | undefined {
  return CHECKS.find((check) => check.name === name)
}

export function defaultChecks(): Check[] {
  return CHECKS.filter((check) => check.inDefaultRun)
}
