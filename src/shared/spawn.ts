import spawn from 'cross-spawn'

import { emit, isCapturing } from './output.ts'

// Honours single/double quotes so a quoted default like --ignore "**/*.test.*" stays one argv entry. Not a full shell parser.
export function tokenizeCommand(command: string): string[] {
  const argv: string[] = []
  let current = ''
  let started = false
  let quote: '"' | "'" | null = null
  for (const ch of command) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      started = true
      continue
    }
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (started) {
        argv.push(current)
        current = ''
        started = false
      }
      continue
    }
    current += ch
    started = true
  }
  if (started) argv.push(current)
  return argv
}

// Passthrough args stay as their own literal entries (never re-parsed) so globs/spaces/metacharacters reach the tool intact.
export function buildArgv(command: string, extraArgs: readonly string[] = []): string[] {
  return [...tokenizeCommand(command), ...extraArgs]
}

const SAFE_ARG = /^[A-Za-z0-9_@%+=:,./-]+$/

function quoteForDisplay(arg: string): string {
  if (arg.length > 0 && SAFE_ARG.test(arg)) return arg
  return `"${arg.replace(/(["\\$`])/g, '\\$1')}"`
}

/** Render an argv array as a copy-pasteable, safely-quoted command line for diagnostics only (never executed). */
export function formatCommand(argv: readonly string[]): string {
  return argv.map(quoteForDisplay).join(' ')
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

// A string runs through a shell (consumer verify:*/npm run scripts); an argv array runs with NO shell so entries reach the tool verbatim.
export type Command = string | readonly string[]

type SpawnInvocation = { file: string; args: string[]; shell: boolean }

function toInvocation(command: Command): SpawnInvocation {
  if (typeof command === 'string') return { file: command, args: [], shell: true }
  const [file, ...args] = command
  if (!file) throw new Error('argv command must have at least one entry (the executable)')
  return { file, args, shell: false }
}

export type RunCommandOptions = {
  cwd?: string
  env?: Record<string, string>
  quiet?: boolean
  /** Rewrite the command's buffered output before it is emitted (only applies when output is suppressed/buffered). */
  transform?: (output: string) => string
}

/**
 * Run a command, returning its exit code. Suppressed output (quiet, or under Claude Code) is buffered and
 * flushed to stdout only if the command fails, keeping passing runs quiet.
 */
export function runCommand(command: Command, opts: RunCommandOptions = {}): Promise<number> {
  return new Promise((resolve) => {
    const suppress = shouldSuppress(opts.quiet)
    const { file, args, shell } = toInvocation(command)
    const child = spawn(file, args, {
      stdio: suppress ? 'pipe' : 'inherit',
      shell,
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

export function captureCommand(
  command: Command,
  opts: { cwd?: string; env?: Record<string, string> } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const { file, args, shell } = toInvocation(command)
    const child = spawn(file, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell,
      cwd: opts.cwd ?? process.cwd(),
      env: opts.env ? { ...process.env, ...opts.env } : undefined,
    })
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
