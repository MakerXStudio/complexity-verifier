import { color } from '../shared/color.ts'
import { isVerbose } from '../shared/spawn.ts'

/**
 * Whether to print the preamble + success footer. A clean run is otherwise silent (just exit 0) to save
 * tokens; chatter is shown only when streaming (`--verbose`) or measuring (`--measure`).
 */
export function chatty(measure?: boolean): boolean {
  return isVerbose() || !!measure
}

export type RunOutcome = { name: string; ok: boolean }

/**
 * Report a batch of outcomes: failures are always printed; the "all passed" line only when `showPass`.
 * Returns the process exit code (1 if anything failed, else 0).
 */
export function reportOutcomes(outcomes: readonly RunOutcome[], noun: string, showPass: boolean): number {
  const failed = outcomes.filter((outcome) => !outcome.ok)
  if (failed.length > 0) {
    console.error(color.red(`\n${failed.length} ${noun}(s) failed: ${failed.map((f) => f.name).join(', ')}`))
    return 1
  }
  if (showPass) console.log(color.green(`\nAll ${outcomes.length} ${noun}(s) passed`))
  return 0
}
