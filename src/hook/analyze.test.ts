import { describe, expect, it } from 'vitest'

import { analyzeAddedComments, formatHookFeedback, hasFindings, type HookOptions } from './analyze.ts'

const opts: HookOptions = { maxLines: 2, narration: true, density: 0.3, minAddedLines: 10 }

describe('analyzeAddedComments', () => {
  it('flags a narration comment an edit introduced', () => {
    const f = analyzeAddedComments({ file: 'a.ts', addedText: '// let me wire this up\nconst x = 1' }, opts)
    expect(f.narration).toHaveLength(1)
    expect(hasFindings(f)).toBe(true)
  })

  it('flags a long comment block', () => {
    const f = analyzeAddedComments({ file: 'a.ts', addedText: ['// one', '// two', '// three', 'const x = 1'].join('\n') }, opts)
    expect(f.blocks).toHaveLength(1)
  })

  it('flags a comment-dense edit', () => {
    const lines = Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? `// note ${i}` : `const v${i} = ${i}`))
    const f = analyzeAddedComments({ file: 'a.ts', addedText: lines.join('\n') }, opts)
    expect(f.density).not.toBeNull()
  })

  it('stays clean for a self-documenting edit', () => {
    const f = analyzeAddedComments({ file: 'a.ts', addedText: 'export const total = items.reduce((a, b) => a + b, 0)' }, opts)
    expect(hasFindings(f)).toBe(false)
  })

  it('never flags JSDoc or context: comments', () => {
    const text = ['/**', ' * @param x the input', ' */', '// context: durable note about why', 'const x = 1'].join('\n')
    const f = analyzeAddedComments({ file: 'a.ts', addedText: text }, opts)
    expect(hasFindings(f)).toBe(false)
  })
})

describe('formatHookFeedback', () => {
  it('names the file and includes the pushback', () => {
    const f = analyzeAddedComments({ file: 'a.ts', addedText: '// let me do it\nconst x = 1' }, opts)
    const msg = formatHookFeedback(f)
    expect(msg).toContain('a.ts')
    expect(msg).toContain('context:')
  })
})
