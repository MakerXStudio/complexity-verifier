import type { Command } from 'commander'
import enquirer from 'enquirer'

import { CHECKS, defaultChecks } from '../checks/registry.ts'
import type { AgentTarget } from '../scaffold/agentFiles.ts'
import { applyInit, type InitResult } from '../scaffold/init.ts'
import { color } from '../shared/color.ts'
import { runCommand } from '../shared/spawn.ts'

type Choice = { name: string; message: string; enabled?: boolean }

function collect(value: string, previous: string[]): string[] {
  return [...previous, value]
}

async function multiselect(message: string, choices: Choice[]): Promise<string[]> {
  const response = (await enquirer.prompt({ type: 'multiselect', name: 'selected', message, choices })) as { selected: string[] }
  return response.selected
}

type InitCliOptions = {
  defaultsOnly?: boolean
  yes?: boolean
  select: string[]
  claude?: boolean
  agents?: boolean
}

async function resolveSelections(opts: InitCliOptions): Promise<{ checks: string[]; targets: AgentTarget[] }> {
  const nonInteractive = !!opts.yes || !process.stdin.isTTY
  if (nonInteractive) {
    const targets: AgentTarget[] = []
    if (opts.claude !== false) targets.push('claude')
    if (opts.agents) targets.push('agents')
    return { checks: opts.select.length > 0 ? opts.select : defaultChecks().map((c) => c.name), targets }
  }

  const checks = await multiselect(
    'Select checks to wire up',
    CHECKS.map((c) => ({ name: c.name, message: `${c.name} — ${c.description}`, enabled: c.inDefaultRun })),
  )
  const targets = (await multiselect('Select agent targets', [
    { name: 'claude', message: 'Claude (.claude/commands + skill)', enabled: true },
    { name: 'agents', message: 'Other agents (.agent-skills)', enabled: false },
  ])) as AgentTarget[]
  return { checks, targets }
}

function report(result: InitResult, defaultsOnly: boolean): void {
  if (defaultsOnly) {
    console.log(color.dim('\nDefaults-only: no verify:* scripts written — `verifyx` will run the built-in default set.'))
  }
  console.log(color.green(`\nScripts added: ${result.addedScripts.join(', ') || '(none new)'}`))
  for (const file of result.agentFiles) {
    if (file.action === 'unchanged') continue
    console.log(`  ${file.action === 'created' ? '+' : '~'} ${file.path}`)
  }
  console.log(color.dim('\nRun `verifyx` (or `npm run verify`) to run your verifications.'))
}

/** `verifyx init` — interactively scaffold checks + agent files into the current project. */
export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Scaffold verifications and agent commands into this project')
    .option('--defaults-only', 'do not write verify:* scripts; rely on `verifyx` built-in defaults')
    .option('--yes', 'non-interactive: use flag selections (or defaults) without prompting')
    .option('--select <name>', 'preselect a check by name (repeatable, non-interactive)', collect, [])
    .option('--no-claude', 'do not write .claude/ files (non-interactive)')
    .option('--agents', 'also write .agent-skills/ files (non-interactive)')
    .action(async (opts: InitCliOptions) => {
      const cwd = process.cwd()
      const defaultsOnly = !!opts.defaultsOnly
      const { checks, targets } = await resolveSelections(opts)

      const result = applyInit({ cwd, checks, targets, defaultsOnly })

      if (result.devDeps.length > 0) {
        console.log(`Installing ${result.devDeps.length} devDependenc(ies): ${result.devDeps.join(', ')}`)
        const code = await runCommand(`npm install --save-dev ${result.devDeps.join(' ')}`, { cwd })
        if (code !== 0) console.error(color.yellow('npm install failed — install those devDependencies manually.'))
      }
      report(result, defaultsOnly)
    })
}
