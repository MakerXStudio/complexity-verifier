import type { Command } from 'commander'

import { CHECKS } from '../checks/registry.ts'
import { color } from '../shared/color.ts'

/** `verify list` — show every built-in check, its kind, and whether it runs in the default set. */
export function registerList(program: Command): void {
  program
    .command('list')
    .description('List all built-in checks')
    .action(() => {
      console.log(color.heading('Built-in checks'))
      for (const check of CHECKS) {
        const tags = color.dim(`(${check.kind}, ${check.inDefaultRun ? 'default' : 'opt-in'})`)
        console.log(`  ${color.cyan(check.name.padEnd(18))} ${tags} ${check.description}`)
      }
    })
}
