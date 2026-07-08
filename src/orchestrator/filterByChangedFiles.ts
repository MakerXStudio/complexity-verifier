import { minimatch } from 'minimatch'

import { getChangedFiles } from '../shared/git.ts'
import type { VerifyEntry } from './resolveEntries.ts'

// Ported from https://github.com/staff0rd/assist verify/run/filterByChangedFiles.ts
/** Keep entries with no filter; drop filtered entries whose glob matches nothing in the working-tree diff. */
export function filterByChangedFiles(entries: readonly VerifyEntry[]): VerifyEntry[] {
  if (!entries.some((entry) => entry.filter)) return [...entries]

  const changedFiles = getChangedFiles()
  return entries.filter((entry) => {
    if (!entry.filter) return true
    if (changedFiles.length === 0) return false
    return changedFiles.some((file) => minimatch(file, entry.filter as string))
  })
}
