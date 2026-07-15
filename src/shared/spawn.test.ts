import { describe, expect, it } from 'vitest'

import { captureCommand } from './spawn.ts'

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
})
