import type { Command } from 'commander'

import { type AgentTarget, writeAgentFiles } from '../scaffold/agentFiles.ts'
import { summarise } from '../scaffold/writeManaged.ts'

/** `verify upgrade-docs` — idempotently create/refresh the managed agent command + skill files. */
export function registerUpgradeDocs(program: Command): void {
  program
    .command('upgrade-docs')
    .description('Create or refresh managed agent command/skill files (.claude, .agent-skills)')
    .option('--no-claude', 'skip .claude/ files')
    .option('--no-agents', 'skip .agent-skills/ files')
    .action((opts: { claude?: boolean; agents?: boolean }) => {
      const targets: AgentTarget[] = []
      if (opts.claude !== false) targets.push('claude')
      if (opts.agents !== false) targets.push('agents')

      const results = writeAgentFiles(process.cwd(), targets)
      for (const result of results) {
        if (result.action === 'unchanged') continue
        console.log(`  ${result.action === 'created' ? '+' : '~'} ${result.path}`)
      }
      const summary = summarise(results)
      console.log(`\n${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged.`)
    })
}
