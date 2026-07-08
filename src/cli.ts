#!/usr/bin/env node
import { createRequire } from 'node:module'

import { Command } from 'commander'

import { registerChecks } from './commands/registerChecks.ts'
import { registerInit } from './commands/registerInit.ts'
import { registerList } from './commands/registerList.ts'
import { registerUpgradeDocs } from './commands/registerUpgradeDocs.ts'
import { orchestrate } from './orchestrator/run.ts'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

const program = new Command()

program
  .name('verify')
  .description('A growing collection of code verifications that give AI coding agents back-pressure against writing hard-to-maintain code.')
  .version(pkg.version)
  .option('--all', 'run all verify:* scripts, ignoring diff-based filters')
  .option('--measure', "print a summary table of each verification's status and duration")
  .option('--verbose', 'stream all output instead of suppressing passing runs')
  .option('--check', 'check only — never auto-fix (the default under CI)')
  .option('--fix', 'auto-fix where possible (the default locally)')
  .action(async (opts: { all?: boolean; measure?: boolean; verbose?: boolean; check?: boolean; fix?: boolean }) => {
    process.exitCode = await orchestrate(opts)
  })

registerChecks(program)
registerList(program)
registerInit(program)
registerUpgradeDocs(program)

program.parseAsync().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
