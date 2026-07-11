import { execSync } from 'node:child_process'

function run(command: string): string {
  try {
    return execSync(command, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
  } catch {
    return ''
  }
}

function resolveDiffBase(): string {
  if (!process.env.CI) return 'HEAD'
  const base = process.env.VERIFY_DIFF_BASE || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : '')
  if (!base) return 'HEAD'
  return run(`git merge-base ${base} HEAD`) || 'HEAD'
}

/** Diff used to detect new comments: working tree vs HEAD locally, vs the PR merge base in CI. '' on error. */
export function gitDiffAgainstBase(): string {
  return run(`git diff ${resolveDiffBase()}`)
}
