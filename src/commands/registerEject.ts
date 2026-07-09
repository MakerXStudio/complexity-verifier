import type { Command } from 'commander'

import { applyEject } from '../scaffold/eject.ts'
import { color } from '../shared/color.ts'

/**
 * `verifyx eject <check>` — replace a `verifyx <name>` wrapper script with the underlying tool's raw command,
 * so a consumer can own and customise the invocation (e.g. `verify:lint` → `oxlint .`, `verify:lint:fix` → `oxlint --fix .`).
 */
export function registerEject(program: Command): void {
  program
    .command('eject')
    .description("Inline an external check's raw tool command into its verify:* script(s) so you can customise it")
    .argument('<check>', 'the external check to eject (e.g. lint, circular-deps)')
    .action((name: string) => {
      try {
        const { scripts } = applyEject(process.cwd(), name)
        console.log(color.green(`Ejected ${name} into package.json:`))
        for (const [script, body] of Object.entries(scripts)) console.log(`  ${color.cyan(script)}: ${body}`)
      } catch (error) {
        console.error(color.yellow((error as Error).message))
        process.exitCode = 1
      }
    })
}
