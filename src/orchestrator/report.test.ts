import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setVerbose } from '../shared/spawn.ts'
import { chatty, reportOutcomes } from './report.ts'

let log: ReturnType<typeof vi.spyOn>
let err: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  log = vi.spyOn(console, 'log').mockImplementation(() => {})
  err = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  log.mockRestore()
  err.mockRestore()
  setVerbose(false)
  delete process.env.CI
  delete process.env.VERIFY_MODE
})

describe('chatty', () => {
  it('is quiet by default (a clean run prints nothing)', () => {
    setVerbose(false)
    expect(chatty(false)).toBe(false)
  })

  it('is loud when --measure is set', () => {
    setVerbose(false)
    expect(chatty(true)).toBe(true)
  })

  it('is loud when verbose is set', () => {
    setVerbose(true)
    expect(chatty(false)).toBe(true)
  })
})

describe('reportOutcomes', () => {
  const passing = [
    { name: 'lint', ok: true },
    { name: 'complexity', ok: true },
  ]

  it('is silent and returns 0 on success when not chatty', () => {
    const code = reportOutcomes(passing, 'verification', false)
    expect(code).toBe(0)
    expect(log).not.toHaveBeenCalled()
    expect(err).not.toHaveBeenCalled()
  })

  it('prints the pass line and returns 0 on success when chatty', () => {
    const code = reportOutcomes(passing, 'verification', true)
    expect(code).toBe(0)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0]?.[0]).toContain('All 2 verification(s) passed')
  })

  it('always reports failures (and returns 1) regardless of chatty', () => {
    const outcomes = [
      { name: 'lint', ok: true },
      { name: 'unused-code', ok: false },
      { name: 'circular-deps', ok: false },
    ]
    const code = reportOutcomes(outcomes, 'verification', false)
    expect(code).toBe(1)
    expect(err).toHaveBeenCalledTimes(1)
    const message = String(err.mock.calls[0]?.[0])
    expect(message).toContain('2 verification(s) failed')
    expect(message).toContain('unused-code')
    expect(message).toContain('circular-deps')
    expect(log).not.toHaveBeenCalled()
  })
})
