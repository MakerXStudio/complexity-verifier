import spawn from 'cross-spawn'

import { emit, isCapturing } from './output.ts'

/** Append user-supplied arguments without parsing, splitting, or shell expansion. */
export function appendArgv(command: readonly string[], extraArgs: readonly string[] = []): string[] {
  return [...command, ...extraArgs]
}

/** Render the exact argv used by a process in a platform-neutral diagnostic form. */
export function formatArgv(argv: readonly string[]): string {
  return JSON.stringify(argv)
}

const SAFE_SHELL_ARG = /^[A-Za-z0-9_@+=:,./-]+$/
const PORTABLE_QUOTED_ARG = /^[^"\\$`%!\r\n]*$/

function formatShellArg(arg: string): string {
  if (arg.length > 0 && SAFE_SHELL_ARG.test(arg)) return arg
  if (!PORTABLE_QUOTED_ARG.test(arg)) {
    throw new Error(`cannot safely serialize argument for both POSIX and Windows npm scripts: ${JSON.stringify(arg)}`)
  }
  return `"${arg}"`
}

function assertNonEmptyArgv(argv: readonly string[]): asserts argv is readonly [string, ...string[]] {
  if (argv.length === 0) throw new Error('argv command must have at least one entry (the executable)')
}

/** Serialize a trusted built-in argv for a cross-platform package.json script. */
export function formatShellCommand(argv: readonly string[]): string {
  assertNonEmptyArgv(argv)
  return argv.map(formatShellArg).join(' ')
}

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

type SpawnInvocation = { file: string; args: string[]; shell: boolean }

function shellInvocation(command: string): SpawnInvocation {
  return { file: command, args: [], shell: true }
}

function argvInvocation(argv: readonly string[]): SpawnInvocation {
  assertNonEmptyArgv(argv)
  const [file, ...args] = argv
  return { file, args, shell: false }
}

type SpawnOptions = { cwd?: string; env?: Record<string, string> }

function spawnChild(invocation: SpawnInvocation, stdio: 'inherit' | 'pipe' | ['ignore', 'pipe', 'pipe'], opts: SpawnOptions) {
  return spawn(invocation.file, invocation.args, {
    stdio,
    shell: invocation.shell,
    cwd: opts.cwd ?? process.cwd(),
    env: opts.env ? { ...process.env, ...opts.env } : undefined,
  })
}

export type RunCommandOptions = SpawnOptions & {
  quiet?: boolean
  /** Rewrite the command's buffered output before it is emitted (only applies when output is suppressed/buffered). */
  transform?: (output: string) => string
}

function runInvocation(invocation: SpawnInvocation, opts: RunCommandOptions): Promise<number> {
  return new Promise((resolve) => {
    const suppress = shouldSuppress(opts.quiet)
    const child = spawnChild(invocation, suppress ? 'pipe' : 'inherit', opts)
    const chunks: Buffer[] = []
    if (suppress) {
      child.stdout?.on('data', (data: Buffer) => chunks.push(data))
      child.stderr?.on('data', (data: Buffer) => chunks.push(data))
    }
    child.on('close', (code) => {
      const exitCode = code ?? 1
      // When capturing (parallel `verifyx all`), hand all output to the buffer; otherwise flush only on failure.
      if (suppress && chunks.length > 0 && (isCapturing() || exitCode !== 0)) {
        const out = Buffer.concat(chunks).toString()
        emit(opts.transform ? opts.transform(out) : out)
      }
      resolve(exitCode)
    })
    child.on('error', (error) => {
      emit(`${String(error)}\n`, 'err')
      resolve(127)
    })
  })
}

/** Run a consumer-owned command through the platform shell. */
export function runShellCommand(command: string, opts: RunCommandOptions = {}): Promise<number> {
  return runInvocation(shellInvocation(command), opts)
}

/** Run a structured argv directly, using no shell. */
export function runArgvCommand(argv: readonly string[], opts: RunCommandOptions = {}): Promise<number> {
  return runInvocation(argvInvocation(argv), opts)
}

/** Run a structured argv directly and capture stdout/stderr separately. */
export function captureArgvCommand(
  argv: readonly string[],
  opts: SpawnOptions = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawnChild(argvInvocation(argv), ['ignore', 'pipe', 'pipe'], opts)
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout?.on('data', (data: Buffer) => out.push(data))
    child.stderr?.on('data', (data: Buffer) => err.push(data))
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() })
    })
    child.on('error', (error) => resolve({ code: 127, stdout: '', stderr: String(error) }))
  })
}
