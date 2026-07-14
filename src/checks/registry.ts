import fs from 'node:fs'

import { withoutRed } from '../shared/color.ts'
import { runComments } from './comments.ts'
import { runComplexity } from './complexity.ts'
import { defineExternalCheck } from './external.ts'
import { runForbiddenStrings } from './forbidden-strings.ts'
import { runHardcodedColors } from './hardcoded-colors.ts'
import { jscpdCount, knipCount } from './maxWarnings.ts'
import type { Check, CheckResult } from './types.ts'

function nativeCheck(name: string, description: string, recommended: boolean, run: () => CheckResult, script = `verifyx ${name}`): Check {
  return {
    name,
    description,
    kind: 'native',
    recommended,
    // Native checks scaffold as a call back into this CLI's own subcommand.
    scaffold: { script },
    runDefault: async () => run(),
  }
}

// context: checks are named for their function, never the tool behind them (see each check's bin/devDeps).
export const CHECKS: Check[] = [
  nativeCheck('complexity', 'Maintainability-index gate (cyclomatic + Halstead + SLOC)', true, () => runComplexity()),
  nativeCheck(
    'comments',
    'Flag long comment blocks (JSDoc / context: exempt); --block-new-comments also fails comments on changed lines',
    true,
    () => runComments({ pushback: true }),
    'verifyx comments --pushback',
  ),
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
    maxWarnings: { unit: 'unused item', count: knipCount },
  }),
  defineExternalCheck({
    name: 'circular-deps',
    description: 'Circular dependency detection',
    bin: 'skott',
    checkCommand: 'skott --displayMode=raw --showCircularDependencies --exitCodeOnCircularDependencies=1',
    devDeps: ['skott'],
    docs: 'https://github.com/antoine-coulon/skott',
    // skott needs a target; scaffold it after `--` so consumers can see and adjust it (e.g. to their source layout).
    scaffoldArgs: 'src/*.ts',
  }),
  defineExternalCheck({
    name: 'duplicate-code',
    description: 'Copy-paste / duplicate-code detection',
    bin: 'jscpd',
    checkCommand: 'jscpd --format typescript,tsx --exit-code 1 --ignore "**/*.test.*" -r consoleFull src',
    devDeps: ['jscpd'],
    // jscpd hardcodes red header cells in its stats table (even on a clean run) — reads like a failure. It ignores
    // NO_COLOR/FORCE_COLOR, so strip the red foreground from its output; the table renders in the default colour.
    transformOutput: withoutRed,
    docs: 'https://github.com/kucherenko/jscpd/tree/master/apps/jscpd#config',
    maxWarnings: { unit: 'clone', count: jscpdCount },
  }),
]

export function getCheck(name: string): Check | undefined {
  return CHECKS.find((check) => check.name === name)
}

export function recommendedChecks(): Check[] {
  return CHECKS.filter((check) => check.recommended)
}
