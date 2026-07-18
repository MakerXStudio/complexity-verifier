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

  // Regression: forwarded passthrough args used to be joined into a shell string, so the spawn shell
  // glob-expanded/word-split them before the tool saw them. An argv array must reach the tool verbatim.
  it('passes an argv array to the process with no shell, so globs and metacharacters arrive literally', async () => {
    const echoArgv = 'process.stdout.write(JSON.stringify(process.argv.slice(1)))'
    const passthrough = ['--ignore', '**/generated/**', 'has space', '$HOME', ';whoami']
    const { code, stdout } = await captureCommand(['node', '-e', echoArgv, '--', ...passthrough])
    expect(code).toBe(0)
    expect(JSON.parse(stdout)).toEqual(passthrough)
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
