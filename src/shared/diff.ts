// Ported from https://github.com/staff0rd/assist verify/blockComments/parseDiffAddedLines.ts
export type AddedLines = Map<string, Set<number>>

const FILE_HEADER = /^\+\+\+ (?:b\/)?(.+)$/
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/** Map each file in a unified diff to the set of 1-based line numbers that were added or changed. */
export function parseDiffAddedLines(diff: string): AddedLines {
  const added: AddedLines = new Map()
  let currentFile: string | null = null
  let newLine = 0

  for (const line of diff.split('\n')) {
    const fileMatch = line.match(FILE_HEADER)
    if (fileMatch) {
      const file = fileMatch[1] as string
      currentFile = file === '/dev/null' ? null : file
      continue
    }

    const hunkMatch = line.match(HUNK_HEADER)
    if (hunkMatch) {
      newLine = Number(hunkMatch[1])
      continue
    }

    if (currentFile === null) continue

    if (line.startsWith('+')) {
      let set = added.get(currentFile)
      if (!set) {
        set = new Set()
        added.set(currentFile, set)
      }
      set.add(newLine)
      newLine++
    } else if (!line.startsWith('-')) {
      newLine++
    }
  }

  return added
}

/** Map each file in a unified diff to the content of the lines it removed (the `-` lines, marker stripped). */
export function parseDiffRemovedLines(diff: string): Map<string, string[]> {
  const removed = new Map<string, string[]>()
  let currentFile: string | null = null

  for (const line of diff.split('\n')) {
    const fileMatch = line.match(FILE_HEADER)
    if (fileMatch) {
      const file = fileMatch[1] as string
      currentFile = file === '/dev/null' ? null : file
      continue
    }
    if (line.startsWith('---') || HUNK_HEADER.test(line) || currentFile === null) continue
    if (line.startsWith('-')) {
      const arr = removed.get(currentFile) ?? []
      arr.push(line.slice(1))
      removed.set(currentFile, arr)
    }
  }

  return removed
}
