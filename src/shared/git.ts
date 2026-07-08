import { execSync } from 'node:child_process'

/** Full working-tree diff against HEAD. Returns '' when git is unavailable or this is not a repo. */
export function gitDiffHead(): string {
  try {
    return execSync('git diff HEAD', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return ''
  }
}

/** Files changed against HEAD (staged + unstaged). Empty when git is unavailable or nothing changed. */
export function getChangedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf8' }).trim()
    return output === '' ? [] : output.split(/\r?\n/)
  } catch {
    return []
  }
}
