import { color } from '../shared/color.ts'
import { isVerbose } from '../shared/spawn.ts'

/**
 * Whether to print the preamble + per-check output + success footer. A clean run is otherwise silent (just
 * exit 0) to save tokens; that chatter is shown only under `--verbose`. `--measure` prints just its table.
 */
export function chatty(): boolean {
  return isVerbose()
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
