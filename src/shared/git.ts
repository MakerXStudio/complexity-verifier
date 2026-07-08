import { execSync } from 'node:child_process'

/** Full working-tree diff against HEAD. Returns '' when git is unavailable or this is not a repo. */
export function gitDiffHead(): string {
  try {
    return execSync('git diff HEAD', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return ''
  }
}
