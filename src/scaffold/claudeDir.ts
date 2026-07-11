import fs from 'node:fs'
import path from 'node:path'

const MAX_PARENTS = 3

function findGitRoot(from: string): string | null {
  let dir = from
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/**
 * Resolve which directory init should write its `.claude` / `.agent-skills` integration into. Claude Code loads
 * project settings only from the directory it is launched from (no inheritance), so the nearest existing
 * `.claude` is the best available signal for that launch root: use `cwd` if it has one, else the closest ancestor
 * within `MAX_PARENTS` (never climbing past the git root), else fall back to creating one at `cwd`. An explicit
 * override always wins.
 */
export function resolveClaudeDir(cwd: string, override?: string): string {
  if (override) return path.resolve(cwd, override)
  if (fs.existsSync(path.join(cwd, '.claude'))) return cwd

  const gitRoot = findGitRoot(cwd)
  let dir = cwd
  for (let i = 0; i < MAX_PARENTS; i++) {
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
    if (fs.existsSync(path.join(dir, '.claude'))) return dir
    if (gitRoot && dir === gitRoot) break
  }
  return cwd
}
