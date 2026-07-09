import { describe, expect, it } from 'vitest'

import type { NewComment } from './comment-common.ts'
import { findCommentDensity, findNarrationComments } from './comment-heuristics.ts'

function comment(text: string, line = 1): NewComment {
  return { file: 'a.ts', line, text }
}

describe('findNarrationComments', () => {
  it('flags session-narration phrases', () => {
    const flagged = [
      '// let me add the handler',
      '// as requested, wire it up',
      "// now I'll return the result",
      '// this function returns the total',
      '// First, validate the input',
      '// added the retry because it was flaky',
    ].map((t, i) => comment(t, i + 1))
    expect(findNarrationComments(flagged)).toHaveLength(flagged.length)
  })

  it('leaves genuine why-comments alone', () => {
    const kept = [comment('// Stripe rejects amounts under 50c'), comment('// matches the wire format the gateway expects')]
    expect(findNarrationComments(kept)).toEqual([])
  })

  it('never flags exempt comments (context: / machine directives)', () => {
    const exempt = [comment('// context: let me keep this durable note'), comment('// eslint-disable-next-line -- let me disable')]
    expect(findNarrationComments(exempt)).toEqual([])
  })
})

describe('findCommentDensity', () => {
  const opts = { threshold: 0.3, minAddedLines: 10 }

  it('flags a file over the density threshold', () => {
    const perFile = new Map([['a.ts', { added: 10, commentLines: 4 }]])
    const [v] = findCommentDensity(perFile, opts)
    expect(v).toMatchObject({ file: 'a.ts', added: 10, commentLines: 4 })
    expect(v?.ratio).toBeCloseTo(0.4)
  })

  it('ignores tiny diffs below minAddedLines', () => {
    const perFile = new Map([['a.ts', { added: 9, commentLines: 9 }]])
    expect(findCommentDensity(perFile, opts)).toEqual([])
  })

  it('passes a file under the threshold', () => {
    const perFile = new Map([['a.ts', { added: 20, commentLines: 5 }]])
    expect(findCommentDensity(perFile, opts)).toEqual([])
  })
})
