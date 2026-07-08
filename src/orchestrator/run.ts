import { color } from '../shared/color.ts'
import { runCommand, setVerbose } from '../shared/spawn.ts'
import { filterByChangedFiles } from './filterByChangedFiles.ts'
import { type MeasureRecord, printMeasureTable } from './measure.ts'
import { resolveEntries, type VerifyEntry } from './resolveEntries.ts'
import { runDefaults } from './runDefaults.ts'

export type OrchestrateOptions = {
  all?: boolean
  measure?: boolean
  verbose?: boolean
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
 * The default `verify` action. Convention: if the project defines `verify:*` scripts, run those in parallel
 * (output buffered, flushed only on failure); otherwise run the built-in default check set in-process.
 */
export async function orchestrate(opts: OrchestrateOptions = {}): Promise<number> {
  setVerbose(!!opts.verbose)

  const allEntries = resolveEntries()
  if (allEntries.length === 0) return runDefaults({ measure: opts.measure })

  const entries = opts.all ? allEntries : filterByChangedFiles(allEntries)
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
