import type { Command } from 'commander'
import enquirer from 'enquirer'

import { CHECKS, recommendedChecks } from '../checks/registry.ts'
import type { AgentTarget } from '../scaffold/agentFiles.ts'
import { applyInit, type InitResult } from '../scaffold/init.ts'
import { ACTION_MARK } from '../scaffold/writeManaged.ts'
import { color } from '../shared/color.ts'
import { runCommand } from '../shared/spawn.ts'

type Choice = { name: string; message: string; enabled?: boolean }

function collect(value: string, previous: string[]): string[] {
  return [...previous, value]
}

async function ask<T>(type: 'select' | 'multiselect', message: string, choices: Choice[]): Promise<T> {
  const response = (await enquirer.prompt({ type, name: 'selected', message, choices })) as { selected: T }
  return response.selected
}

type InitCliOptions = {
  defaultsOnly?: boolean
  yes?: boolean
  select: string[]
  claude?: boolean
  agents?: boolean
}

type Selections = { checks: string[]; targets: AgentTarget[]; defaultsOnly: boolean }

async function resolveSelections(opts: InitCliOptions): Promise<Selections> {
  const nonInteractive = !!opts.yes || !process.stdin.isTTY
  if (nonInteractive) {
    const targets: AgentTarget[] = []
    if (opts.claude !== false) targets.push('claude')
    if (opts.agents) targets.push('agents')
    return {
      checks: opts.select.length > 0 ? opts.select : recommendedChecks().map((c) => c.name),
      targets,
      defaultsOnly: !!opts.defaultsOnly,
    }
  }

  // context: an up-front choice — run everything with defaults (verifyx all, no verify:* scripts), or hand-pick checks.
  const mode = await ask<string>('select', 'How should verify run?', [
    { name: 'defaults', message: 'Run all built-in checks (verifyx all) with default options', enabled: true },
    { name: 'pick', message: 'Pick specific checks to wire up as verify:* scripts' },
  ])
  const defaultsOnly = mode === 'defaults'

  // Defaults-only still passes every check so applyInit installs all their devDeps; hand-picking narrows the list.
  const checks = defaultsOnly
    ? CHECKS.map((c) => c.name)
    : await ask<string[]>(
        'multiselect',
        'Select checks to wire up',
        CHECKS.map((c) => ({ name: c.name, message: `${c.name} — ${c.description}`, enabled: c.recommended })),
      )
  const targets = await ask<AgentTarget[]>('multiselect', 'Select agent targets', [
    { name: 'claude', message: 'Claude (.claude/skills + CLAUDE.md)', enabled: true },
    { name: 'agents', message: 'Other agents (.agent-skills + AGENTS.md)', enabled: false },
  ])
  return { checks, targets, defaultsOnly }
}

function report(result: InitResult, defaultsOnly: boolean): void {
  if (defaultsOnly) {
    console.log(color.dim('\nDefaults-only: no verify:* scripts written — the `verify` script runs `verifyx all` (every built-in).'))
  }
  console.log(color.green(`\nScripts added: ${result.addedScripts.join(', ') || '(none new)'}`))
  for (const file of result.agentFiles) {
    if (file.action === 'unchanged') continue
    console.log(`  ${ACTION_MARK[file.action]} ${file.path} (${file.action})`)
  }
  console.log(color.dim('\nRun `npm run verify` (or `npx verifyx`) to run your verifications.'))
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
      const { checks, targets, defaultsOnly } = await resolveSelections(opts)

      const result = applyInit({ cwd, checks, targets, defaultsOnly })

      if (result.devDeps.length > 0) {
        console.log(`Installing ${result.devDeps.length} devDependenc(ies): ${result.devDeps.join(', ')}`)
        const code = await runCommand(`npm install --save-dev ${result.devDeps.join(' ')}`, { cwd })
        if (code !== 0) console.error(color.yellow('npm install failed — install those devDependencies manually.'))
      }
      report(result, defaultsOnly)
    })
}
