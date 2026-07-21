import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { appendArgv, captureArgvCommand, formatArgv, formatShellCommand } from './spawn.ts'

describe('captureArgvCommand', () => {
  it('returns the captured stdout and a zero exit code for a successful command', async () => {
    const command =
      process.platform === 'win32' ? [process.execPath, '-e', "process.stdout.write('captured-output')"] : ['printf', 'captured-output']
    const { code, stdout } = await captureArgvCommand(command)
    expect(code).toBe(0)
    expect(stdout).toBe('captured-output')
  })

  it('surfaces a non-zero exit code without throwing', async () => {
    const command = process.platform === 'win32' ? [process.execPath, '-e', 'process.exit(3)'] : ['sh', '-c', 'exit 3']
    const { code } = await captureArgvCommand(command)
    expect(code).toBe(3)
  })

  it('captures stderr separately from stdout', async () => {
    const command =
      process.platform === 'win32' ? [process.execPath, '-e', "process.stderr.write('to-stderr')"] : ['sh', '-c', 'printf to-stderr >&2']
    const { stdout, stderr } = await captureArgvCommand(command)
    expect(stdout).toBe('')
    expect(stderr).toContain('to-stderr')
  })

  it('returns the spawn error when an argv executable cannot be launched', async () => {
    const { code, stderr } = await captureArgvCommand(['verifyx-command-that-does-not-exist'])
    expect(code).toBe(127)
    expect(stderr).toContain('ENOENT')
  })

  // Regression: forwarded passthrough args used to be joined into a shell string, so the spawn shell
  // glob-expanded/word-split them before the tool saw them. An argv array must reach the tool verbatim.
  it('passes an argv array to the process with no shell, so globs and metacharacters arrive literally', async () => {
    const passthrough = ['--ignore', '**/generated/**', 'has space', '$HOME', ';whoami']
    const command =
      process.platform === 'win32'
        ? [process.execPath, '-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', '--', ...passthrough]
        : ['printf', '%s\\n', ...passthrough]
    const { code, stdout } = await captureArgvCommand(command)
    expect(code).toBe(0)
    expect(process.platform === 'win32' ? JSON.parse(stdout) : stdout.split('\n').slice(0, -1)).toEqual(passthrough)
  })

  it.runIf(process.platform === 'win32')('launches npm-style .cmd shims without interpreting their arguments', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verifyx-spawn-'))
    const binDir = path.join(root, 'node_modules', '.bin')
    fs.mkdirSync(binDir, { recursive: true })
    fs.writeFileSync(path.join(binDir, 'verifyx-echo-argv.cjs'), 'process.stdout.write(JSON.stringify(process.argv.slice(2)))')
    fs.writeFileSync(path.join(binDir, 'verifyx-echo-argv.cmd'), '@ECHO off\r\nnode "%~dp0\\verifyx-echo-argv.cjs" %*\r\n')

    const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
    const env = { [pathKey]: `${binDir}${path.delimiter}${process.env[pathKey] ?? ''}` }
    const passthrough = ['**/*.ts', 'has space', '$HOME', '%PATH%', ';whoami', 'a&b']

    try {
      const { code, stdout, stderr } = await captureArgvCommand(['verifyx-echo-argv', ...passthrough], { env })
      expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
      expect(JSON.parse(stdout)).toEqual(passthrough)
    } finally {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 })
    }
  })
})

describe('appendArgv', () => {
  it('appends passthrough args as their own literal entries', () => {
    expect(appendArgv(['jscpd', 'src'], ['--ignore', '**/generated/**', 'has space'])).toEqual([
      'jscpd',
      'src',
      '--ignore',
      '**/generated/**',
      'has space',
    ])
  })
})

describe('formatArgv', () => {
  it('renders exact argv without making platform-specific shell quoting claims', () => {
    expect(formatArgv(['tool', 'C:\\src path', '$HOME', '%PATH%'])).toBe('["tool","C:\\\\src path","$HOME","%PATH%"]')
  })
})

describe('formatShellCommand', () => {
  it('serializes built-in argv for package.json scripts on POSIX and Windows', () => {
    expect(formatShellCommand(['jscpd', '--ignore', '**/*.test.*', 'src'])).toBe('jscpd --ignore "**/*.test.*" src')
  })

  it('rejects arguments that cannot be serialized consistently for both shells', () => {
    expect(() => formatShellCommand(['tool', '$HOME'])).toThrow('cannot safely serialize')
  })
})
