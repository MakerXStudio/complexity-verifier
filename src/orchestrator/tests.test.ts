import { describe, expect, it } from 'vitest'

import { resolveTestScript } from './tests.ts'

describe('resolveTestScript', () => {
  it('prefers an explicit verify:test locally, then the standard test script', () => {
    expect(resolveTestScript({ 'verify:test': 'vitest run --silent', test: 'vitest' }, false)).toBe('verify:test')
    expect(resolveTestScript({ test: 'vitest' }, false)).toBe('test')
  })

  it('runs only test:ci on CI, never a plain test/verify:test', () => {
    expect(resolveTestScript({ 'verify:test': 'x', test: 'y', 'test:ci': 'vitest run --reporter=junit' }, true)).toBe('test:ci')
    expect(resolveTestScript({ 'verify:test': 'x', test: 'y' }, true)).toBeNull()
  })

  it('returns null when no applicable script exists', () => {
    expect(resolveTestScript({ build: 'tsc' }, false)).toBeNull()
    expect(resolveTestScript({}, true)).toBeNull()
  })
})
