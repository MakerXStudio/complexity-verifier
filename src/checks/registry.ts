import fs from 'node:fs'

import { runBlockComments } from './block-comments.ts'
import { runCommentBlock } from './comment-block.ts'
import { runComplexity } from './complexity.ts'
import { defineExternalCheck } from './external.ts'
import { runForbiddenStrings } from './forbidden-strings.ts'
import { runHardcodedColors } from './hardcoded-colors.ts'
import type { Check, CheckResult } from './types.ts'

function nativeCheck(name: string, description: string, recommended: boolean, run: () => CheckResult): Check {
  return {
    name,
    description,
    kind: 'native',
    recommended,
    // Native checks scaffold as a call back into this CLI's own subcommand.
    scaffold: { script: `verifyx ${name}` },
    runDefault: async () => run(),
  }
}

// context: checks are named for their function, never the tool behind them (see each check's bin/devDeps).
export const CHECKS: Check[] = [
  nativeCheck('complexity', 'Maintainability-index gate (cyclomatic + Halstead + SLOC)', true, () => runComplexity()),
  nativeCheck('comment-block', 'Flag comment blocks longer than the limit (JSDoc / context: exempt)', true, () => runCommentBlock()),
  nativeCheck('block-comments', 'Fail on any comment added to a line changed against HEAD', false, () => runBlockComments()),
  nativeCheck('hardcoded-colors', 'Fail on literal hex / 0x colour values in source', false, () => runHardcodedColors()),
  nativeCheck('forbidden-strings', 'Fail on disallowed JSON config values (rules from verify config)', false, () => runForbiddenStrings()),
  defineExternalCheck({
    name: 'lint',
    description: 'Lint — auto-fixes locally, checks in CI',
    bin: 'oxlint',
    checkCommand: 'oxlint .',
    fixCommand: 'oxlint --fix .',
    devDeps: ['oxlint'],
    recommended: true,
    docs: 'https://oxc.rs/docs/guide/usage/linter.html',
  }),
  defineExternalCheck({
    name: 'format',
    description: 'Formatting — writes locally, checks in CI',
    bin: 'oxfmt',
    checkCommand: 'oxfmt --check .',
    fixCommand: 'oxfmt .',
    devDeps: ['oxfmt'],
    recommended: true,
    docs: 'https://oxc.rs',
  }),
  defineExternalCheck({
    name: 'check-types',
    description: 'TypeScript type check',
    bin: 'tsc',
    checkCommand: 'tsc --noEmit',
    devDeps: ['typescript'],
    canRun: () => fs.existsSync('tsconfig.json'),
    recommended: true,
    docs: 'https://www.typescriptlang.org/tsconfig',
  }),
  defineExternalCheck({
    name: 'unused-code',
    description: 'Unused files, exports and dependencies',
    bin: 'knip',
    checkCommand: 'knip --no-progress --treat-config-hints-as-errors',
    devDeps: ['knip'],
    docs: 'https://knip.dev/reference/configuration',
  }),
  defineExternalCheck({
    name: 'circular-deps',
    description: 'Circular dependency detection',
    bin: 'skott',
    checkCommand: 'skott --displayMode=raw --showCircularDependencies --exitCodeOnCircularDependencies=1',
    devDeps: ['skott'],
    docs: 'https://github.com/antoine-coulon/skott',
  }),
  defineExternalCheck({
    name: 'duplicate-code',
    description: 'Copy-paste / duplicate-code detection',
    bin: 'jscpd',
    checkCommand: 'jscpd --format typescript,tsx --exit-code 1 --ignore "**/*.test.*" -r consoleFull src',
    devDeps: ['jscpd'],
    docs: 'https://github.com/kucherenko/jscpd/tree/master/apps/jscpd#config',
  }),
]

export function getCheck(name: string): Check | undefined {
  return CHECKS.find((check) => check.name === name)
}

export function recommendedChecks(): Check[] {
  return CHECKS.filter((check) => check.recommended)
}
