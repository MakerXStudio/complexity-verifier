import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { configureMode, resolveMode } from './mode.ts'

const saved: { ci?: string; mode?: string } = {}

beforeEach(() => {
  saved.ci = process.env.CI
  saved.mode = process.env.VERIFY_MODE
  delete process.env.CI
  delete process.env.VERIFY_MODE
})
afterEach(() => {
  if (saved.ci === undefined) delete process.env.CI
  else process.env.CI = saved.ci
  if (saved.mode === undefined) delete process.env.VERIFY_MODE
  else process.env.VERIFY_MODE = saved.mode
})

describe('resolveMode', () => {
  it('defaults to fix locally (no CI, no override)', () => {
    expect(resolveMode()).toBe('fix')
  })

  it('is check under CI', () => {
    process.env.CI = 'true'
    expect(resolveMode()).toBe('check')
  })

  it('lets VERIFY_MODE override CI (fix in CI)', () => {
    process.env.CI = 'true'
    process.env.VERIFY_MODE = 'fix'
    expect(resolveMode()).toBe('fix')
  })

  it('honours VERIFY_MODE=check with no CI', () => {
    process.env.VERIFY_MODE = 'check'
    expect(resolveMode()).toBe('check')
  })

  it('ignores an unrecognised VERIFY_MODE value', () => {
    process.env.VERIFY_MODE = 'nonsense'
    expect(resolveMode()).toBe('fix')
  })
})

describe('configureMode', () => {
  it('sets VERIFY_MODE=check for --check so it propagates to child scripts', () => {
    configureMode({ check: true })
    expect(process.env.VERIFY_MODE).toBe('check')
    expect(resolveMode()).toBe('check')
  })

  it('sets VERIFY_MODE=fix for --fix, overriding CI', () => {
    process.env.CI = 'true'
    configureMode({ fix: true })
    expect(resolveMode()).toBe('fix')
  })

  it('leaves the environment untouched when neither flag is given', () => {
    configureMode({})
    expect(process.env.VERIFY_MODE).toBeUndefined()
  })
})
