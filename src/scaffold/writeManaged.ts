import fs from 'node:fs'
import path from 'node:path'

// Ported from https://github.com/MakerXStudio data-streams CLI upgrade-docs.ts writeManaged.
type ManagedAction = 'unchanged' | 'updated' | 'created'

export type ManagedFileResult = {
  path: string
  action: ManagedAction
}

function readIfExists(file: string): string | null {
  if (!fs.existsSync(file)) return null
  return fs.readFileSync(file, 'utf-8')
}

/**
 * Idempotently write a CLI-managed file: create if missing, rewrite if changed, leave alone if identical.
 * Refuses to write through a symlink or over a non-regular file.
 */
export function writeManaged(file: string, contents: string, results: ManagedFileResult[]): void {
  const existing = readIfExists(file)
  if (existing === null) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, contents, { encoding: 'utf8', flag: 'wx' })
    results.push({ path: file, action: 'created' })
    return
  }
  if (existing === contents) {
    results.push({ path: file, action: 'unchanged' })
    return
  }
  const stat = fs.lstatSync(file)
  if (stat.isSymbolicLink()) throw new Error(`Refusing to write through symlink at ${file}`)
  if (!stat.isFile()) throw new Error(`Refusing to overwrite non-regular file at ${file}`)
  fs.writeFileSync(file, contents, { encoding: 'utf8', flag: 'w' })
  results.push({ path: file, action: 'updated' })
}

export function summarise(results: readonly ManagedFileResult[]): { created: number; updated: number; unchanged: number } {
  return {
    created: results.filter((r) => r.action === 'created').length,
    updated: results.filter((r) => r.action === 'updated').length,
    unchanged: results.filter((r) => r.action === 'unchanged').length,
  }
}
