// Ported from https://github.com/staff0rd/assist verify/run/printMeasureTable.ts
export type MeasureRecord = {
  script: string
  code: number
  durationMs: number
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** Print a status/duration summary table for a set of runs, sorted slowest-first, with a TOTAL row. */
export function printMeasureTable(records: readonly MeasureRecord[], totalMs: number): void {
  const rows = [...records]
    .sort((a, b) => b.durationMs - a.durationMs)
    .map((record) => ({
      status: record.code === 0 ? '✓' : '✗',
      name: record.script,
      duration: formatDuration(record.durationMs),
    }))

  const nameWidth = Math.max('Command'.length, 'TOTAL'.length, ...rows.map((row) => row.name.length))
  const durationWidth = Math.max('Duration'.length, formatDuration(totalMs).length, ...rows.map((row) => row.duration.length))

  const line = (status: string, name: string, duration: string): string =>
    `  ${status.padEnd(6)} ${name.padEnd(nameWidth)}  ${duration.padStart(durationWidth)}`
  const separator = `  ${' '.repeat(6)} ${'─'.repeat(nameWidth)}  ${'─'.repeat(durationWidth)}`

  console.log()
  console.log(line('Status', 'Command', 'Duration'))
  for (const row of rows) console.log(line(row.status, row.name, row.duration))
  console.log(separator)
  console.log(line('', 'TOTAL', formatDuration(totalMs)))
}
