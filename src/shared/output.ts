import { AsyncLocalStorage } from 'node:async_hooks'
import util from 'node:util'

// A per-task buffer set by runCaptured; concurrent tasks each get their own, so parallel output never interleaves.
const captureStore = new AsyncLocalStorage<string[]>()

/** True while running inside runCaptured (output is being collected rather than written straight out). */
export function isCapturing(): boolean {
  return captureStore.getStore() !== undefined
}

/** Write text to the active capture buffer if one is set, else straight to the real stdout/stderr stream. */
export function emit(text: string, stream: 'out' | 'err' = 'out'): void {
  const sink = captureStore.getStore()
  if (sink) sink.push(text)
  else if (stream === 'err') process.stderr.write(text)
  else process.stdout.write(text)
}

/** Patch console.* to route through emit(), so output produced anywhere in a task is captured. Returns a restore fn. */
export function installConsoleCapture(): () => void {
  const { log, warn, error } = console
  console.log = (...args: unknown[]): void => emit(`${util.format(...args)}\n`, 'out')
  console.warn = (...args: unknown[]): void => emit(`${util.format(...args)}\n`, 'err')
  console.error = (...args: unknown[]): void => emit(`${util.format(...args)}\n`, 'err')
  return () => {
    console.log = log
    console.warn = warn
    console.error = error
  }
}

/** Run `fn` with everything it emits (via console.* or emit()) collected into a string instead of printed. */
export async function runCaptured<T>(fn: () => Promise<T>): Promise<{ result: T; output: string }> {
  const sink: string[] = []
  const result = await captureStore.run(sink, fn)
  return { result, output: sink.join('') }
}
