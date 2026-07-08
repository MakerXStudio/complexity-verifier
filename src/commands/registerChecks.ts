import type { Command } from 'commander'

import { runBlockComments } from '../checks/block-comments.ts'
import { runCommentBlock } from '../checks/comment-block.ts'
import { runComplexity } from '../checks/complexity.ts'
import { runForbiddenStrings } from '../checks/forbidden-strings.ts'
import { runHardcodedColors } from '../checks/hardcoded-colors.ts'
import { CHECKS } from '../checks/registry.ts'

function finish(ok: boolean): void {
  process.exitCode = ok ? 0 : 1
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value]
}

/** Register a directly-invocable subcommand for every built-in check (`verify complexity`, `verify knip`, …). */
export function registerChecks(program: Command): void {
  program
    .command('complexity')
    .description('Maintainability-index gate')
    .argument('[pattern]', 'glob, directory, or file to analyse')
    .option('--threshold <n>', 'fail files whose minimum MI is below this', Number)
    .option('--ignore <glob>', 'ignore glob (repeatable)', collect, [])
    .action((pattern: string | undefined, opts: { threshold?: number; ignore: string[] }) => {
      finish(runComplexity({ pattern, threshold: opts.threshold, ignore: opts.ignore }).ok)
    })

  program
    .command('comment-block')
    .description('Flag comment blocks longer than the limit (JSDoc / context: exempt)')
    .argument('[pattern]', 'glob, directory, or file to scan')
    .option('--max-lines <n>', 'maximum comment-block length', Number)
    .option('--pushback', 'add AI back-pressure framing to the failure message')
    .option('--warn', 'report without failing the run')
    .option('--ignore <glob>', 'ignore glob (repeatable)', collect, [])
    .action((pattern: string | undefined, opts: { maxLines?: number; pushback?: boolean; warn?: boolean; ignore: string[] }) => {
      finish(runCommentBlock({ pattern, maxLines: opts.maxLines, pushback: opts.pushback, warn: opts.warn, ignore: opts.ignore }).ok)
    })

  program
    .command('block-comments')
    .description('Fail on any comment added to a line changed against HEAD')
    .option('--ignore <glob>', 'ignore glob (repeatable)', collect, [])
    .action((opts: { ignore: string[] }) => {
      finish(runBlockComments({ ignore: opts.ignore }).ok)
    })

  program
    .command('hardcoded-colors')
    .description('Fail on literal hex / 0x colour values in source')
    .option('--root <dir>', 'directory to scan')
    .option('--ignore <glob>', 'ignore glob (repeatable)', collect, [])
    .action((opts: { root?: string; ignore: string[] }) => {
      finish(runHardcodedColors({ root: opts.root, ignore: opts.ignore }).ok)
    })

  program
    .command('forbidden-strings')
    .description('Fail on disallowed JSON config values (rules from verify config)')
    .action(() => {
      finish(runForbiddenStrings().ok)
    })

  // Mode flows via the VERIFY_MODE env / CI, not per-subcommand flags (which collide with the root's --check).
  for (const check of CHECKS.filter((c) => c.kind === 'external')) {
    program
      .command(check.name)
      .description(check.description)
      .action(async () => {
        const result = await check.runDefault()
        finish(result.ok)
      })
  }
}
