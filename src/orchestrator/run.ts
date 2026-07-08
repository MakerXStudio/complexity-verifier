import { configureMode, resolveMode } from '../shared/mode.ts'
import { runCommand, setVerbose } from '../shared/spawn.ts'
import { type MeasureRecord, printMeasureTable } from './measure.ts'
import { chatty, reportOutcomes } from './report.ts'
import { resolveEntries, selectEntries, type VerifyEntry } from './resolveEntries.ts'

export type OrchestrateOptions = {
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

/**
 * The default `verifyx` action. Convention: run the project's own `verify:*` scripts in parallel (output
 * buffered, flushed only on failure). A clean run is silent — use `--verbose` or `--measure` for detail.
 * With no `verify:*` scripts, nothing runs — use `verifyx all` to run every built-in check.
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
  const entries = selectEntries(allEntries, resolveMode())
  if (entries.length === 0) {
    console.log('No verify:* scripts to run for this mode.')
    return 0
  }

  const loud = chatty(opts.measure)
  if (loud) {
    console.log(`Running ${entries.length} verify script(s) in parallel:`)
    for (const entry of entries) console.log(`  - ${entry.name}`)
  }

  const startTime = Date.now()
  const records = await Promise.all(entries.map(runEntry))
  if (opts.measure) printMeasureTable(records, Date.now() - startTime)
  return reportOutcomes(
    records.map((r) => ({ name: r.script, ok: r.code === 0 })),
    'verify script',
    loud,
  )
}
