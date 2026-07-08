import { color } from '../shared/color.ts'
import { configureMode, resolveMode } from '../shared/mode.ts'
import { runCommand, setVerbose } from '../shared/spawn.ts'
import { filterByChangedFiles } from './filterByChangedFiles.ts'
import { type MeasureRecord, printMeasureTable } from './measure.ts'
import { resolveEntries, selectEntries, type VerifyEntry } from './resolveEntries.ts'

export type OrchestrateOptions = {
  /** When false (via --no-filter), run every verify:* script ignoring diff-based filters. */
  filter?: boolean
  measure?: boolean
  verbose?: boolean
  check?: boolean
  fix?: boolean
}

async function runEntry(entry: VerifyEntry): Promise<MeasureRecord> {
  const startTime = Date.now()
  const code = await runCommand(entry.command, { cwd: entry.cwd, quiet: true })
  return { script: entry.name, code, durationMs: Date.now() - startTime }
}

function reportScriptResults(records: readonly MeasureRecord[], total: number): number {
  const failed = records.filter((record) => record.code !== 0)
  if (failed.length > 0) {
    console.error(color.red(`\n${failed.length} script(s) failed:`))
    for (const record of failed) console.error(`  - ${record.script} (exit code ${record.code})`)
    return 1
  }
  console.log(color.green(`\nAll ${total} verify script(s) passed`))
  return 0
}

/**
 * The default `verifyx` action. Convention: run the project's own `verify:*` scripts in parallel (output
 * buffered, flushed only on failure). With no `verify:*` scripts, nothing runs — use `verifyx all` to run
 * every built-in check.
 */
export async function orchestrate(opts: OrchestrateOptions = {}): Promise<number> {
  setVerbose(!!opts.verbose)
  // Propagate an explicit --check/--fix via VERIFY_MODE so it reaches spawned verify:* scripts too.
  configureMode(opts)

  const allEntries = resolveEntries()
  if (allEntries.length === 0) {
    console.log('No verify:* scripts defined — nothing to run. Add verify:* scripts, or run `verifyx all` to run every built-in check.')
    return 0
  }

  // Collapse verify:<name> / verify:<name>:fix pairs to the variant for the current mode.
  const modeEntries = selectEntries(allEntries, resolveMode())
  const entries = opts.filter === false ? modeEntries : filterByChangedFiles(modeEntries)
  if (entries.length === 0) {
    console.log('No verify scripts matched changed files — skipping')
    return 0
  }

  console.log(`Running ${entries.length} verify script(s) in parallel:`)
  for (const entry of entries) console.log(`  - ${entry.name}`)

  const startTime = Date.now()
  const records = await Promise.all(entries.map(runEntry))
  if (opts.measure) printMeasureTable(records, Date.now() - startTime)
  return reportScriptResults(records, entries.length)
}
