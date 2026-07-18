import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildArgv, captureCommand, formatCommand, tokenizeCommand } from './spawn.ts'

describe('captureCommand', () => {
  it('returns the captured stdout and a zero exit code for a successful command', async () => {
    const { code, stdout } = await captureCommand(`node -e "process.stdout.write('captured-output')"`)
    expect(code).toBe(0)
    expect(stdout).toBe('captured-output')
  })

  it('surfaces a non-zero exit code without throwing', async () => {
    const { code } = await captureCommand(`node -e "process.exit(3)"`)
    expect(code).toBe(3)
  })

  it('captures stderr separately from stdout', async () => {
    const { stdout, stderr } = await captureCommand(`node -e "process.stderr.write('to-stderr')"`)
    expect(stdout).toBe('')
    expect(stderr).toContain('to-stderr')
  })

  it('returns the spawn error when an argv executable cannot be launched', async () => {
    const { code, stderr } = await captureCommand(['verifyx-command-that-does-not-exist'])
    expect(code).toBe(127)
    expect(stderr).toContain('ENOENT')
  })

  // Regression: forwarded passthrough args used to be joined into a shell string, so the spawn shell
  // glob-expanded/word-split them before the tool saw them. An argv array must reach the tool verbatim.
  it('passes an argv array to the process with no shell, so globs and metacharacters arrive literally', async () => {
    const echoArgv = 'process.stdout.write(JSON.stringify(process.argv.slice(1)))'
    const passthrough = ['--ignore', '**/generated/**', 'has space', '$HOME', ';whoami']
    const { code, stdout } = await captureCommand(['node', '-e', echoArgv, '--', ...passthrough])
    expect(code).toBe(0)
    expect(JSON.parse(stdout)).toEqual(passthrough)
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
      const { code, stdout, stderr } = await captureCommand(['verifyx-echo-argv', ...passthrough], { env })
      expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
      expect(JSON.parse(stdout)).toEqual(passthrough)
    } finally {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 })
    }
  })
})

describe('tokenizeCommand', () => {
  it('splits on whitespace and strips quotes, keeping a quoted arg as one entry', () => {
    expect(tokenizeCommand('jscpd --ignore "**/*.test.*" -r consoleFull src')).toEqual([
      'jscpd',
      '--ignore',
      '**/*.test.*',
      '-r',
      'consoleFull',
      'src',
    ])
  })
})

describe('buildArgv', () => {
  it('appends passthrough args as their own literal entries', () => {
    expect(buildArgv('jscpd src', ['--ignore', '**/generated/**', 'has space'])).toEqual([
      'jscpd',
      'src',
      '--ignore',
      '**/generated/**',
      'has space',
    ])
  })
})

describe('formatCommand', () => {
  it('quotes only the entries that need it, for a copy-pasteable diagnostic line', () => {
    expect(formatCommand(['jscpd', '--ignore', '**/generated/**', 'plain'])).toBe('jscpd --ignore "**/generated/**" plain')
  })
})
