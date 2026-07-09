#!/usr/bin/env node
import { createRequire } from 'node:module'

import { Command } from 'commander'

import { registerChecks } from './commands/registerChecks.ts'
import { registerEject } from './commands/registerEject.ts'
import { registerInit } from './commands/registerInit.ts'
import { registerList } from './commands/registerList.ts'
import { registerUpgradeDocs } from './commands/registerUpgradeDocs.ts'
import { orchestrate } from './orchestrator/run.ts'
import { runAll } from './orchestrator/runAll.ts'
import { configureMode } from './shared/mode.ts'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

type RunOptions = { measure?: boolean; verbose?: boolean; check?: boolean; fix?: boolean; tests?: boolean }

/** The options shared by the default run and `verifyx all`. */
function withRunOptions(command: Command): Command {
  return command
    .option('--measure', "print a summary table of each verification's status and duration")
    .option('--verbose', 'stream all output instead of suppressing passing runs')
    .option('--check', 'check only — never auto-fix (the default under CI)')
    .option('--fix', 'auto-fix where possible (the default locally)')
    .option('--no-tests', 'skip the automatic tests step (verify:test / test locally, test:ci on CI)')
}

const program = new Command()

withRunOptions(
  program
    .name('verifyx')
    .description(
      'A growing collection of code verifications that give AI coding agents back-pressure against writing hard-to-maintain code.',
    )
    .version(pkg.version),
).action(async (opts: RunOptions) => {
  process.exitCode = await orchestrate(opts)
})

withRunOptions(
  program.command('all').description('Run every built-in check (verify:<name> scripts override the matching built-in)'),
).action(async (_opts: RunOptions, command: Command) => {
  // Run options live on the root command (commander treats them as global), so merge globals to catch flags after `all`.
  const opts = command.optsWithGlobals() as RunOptions
  configureMode(opts)
  process.exitCode = await runAll({ measure: opts.measure, tests: opts.tests, verbose: opts.verbose })
})

registerChecks(program)
registerList(program)
registerInit(program)
registerUpgradeDocs(program)
registerEject(program)

program.parseAsync().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
