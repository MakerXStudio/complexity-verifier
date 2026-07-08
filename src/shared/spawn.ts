import { spawn } from 'node:child_process'

let verboseMode = false

/** When verbose, per-command output is always streamed; otherwise it is buffered and only shown on failure. */
export function setVerbose(verbose: boolean): void {
  verboseMode = verbose
}

export function isVerbose(): boolean {
  return verboseMode
}

function shouldSuppress(quiet?: boolean): boolean {
  if (verboseMode) return false
  return !!quiet || !!process.env.CLAUDECODE
}

export type RunCommandOptions = {
  cwd?: string
  env?: Record<string, string>
  quiet?: boolean
}

/**
 * Run a shell command, returning its exit code. Suppressed output (quiet, or under Claude Code) is buffered
 * and flushed to stdout only if the command fails, keeping passing runs quiet.
 */
export function runCommand(command: string, opts: RunCommandOptions = {}): Promise<number> {
  return new Promise((resolve) => {
    const suppress = shouldSuppress(opts.quiet)
    const child = spawn(command, [], {
      stdio: suppress ? 'pipe' : 'inherit',
      shell: true,
      cwd: opts.cwd ?? process.cwd(),
      env: opts.env ? { ...process.env, ...opts.env } : undefined,
    })
    const chunks: Buffer[] = []
    if (suppress) {
      child.stdout?.on('data', (data: Buffer) => chunks.push(data))
      child.stderr?.on('data', (data: Buffer) => chunks.push(data))
    }
    child.on('close', (code) => {
      const exitCode = code ?? 1
      if (suppress && exitCode !== 0 && chunks.length > 0) process.stdout.write(Buffer.concat(chunks))
      resolve(exitCode)
    })
    child.on('error', () => resolve(127))
  })
}
