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

  it('flags LLM punctuation tells (em-dash, curly quotes)', () => {
    const tells = [comment('// wraps the call — then retries'), comment('// uses the “fast” path')]
    expect(findNarrationComments(tells)).toHaveLength(2)
  })

  it('with allowContext false, stops exempting context: comments (machine directives still exempt)', () => {
    const comments = [comment('// context: let me keep this durable note'), comment('// eslint-disable-next-line -- let me disable')]
    const flagged = findNarrationComments(comments, false)
    expect(flagged).toHaveLength(1)
    expect(flagged[0]?.text).toContain('context:')
  })
})

describe('findCommentDensity', () => {
  const opts = { threshold: 0.3, minAddedLines: 10 }
  const counts = (
    added: number,
    commentLines: number,
    removedComments = 0,
  ): Map<string, { added: number; commentLines: number; removedComments: number }> =>
    new Map([['a.ts', { added, commentLines, removedComments }]])

  it('flags a file over the density threshold', () => {
    const [v] = findCommentDensity(counts(10, 4), opts)
    expect(v).toMatchObject({ file: 'a.ts', added: 10, commentLines: 4 })
    expect(v?.ratio).toBeCloseTo(0.4)
  })

  it('ignores tiny diffs below minAddedLines', () => {
    expect(findCommentDensity(counts(9, 9), opts)).toEqual([])
  })

  it('passes a file under the threshold', () => {
    expect(findCommentDensity(counts(20, 5), opts)).toEqual([])
  })

  it('skips a net comment trim (removed >= added comments)', () => {
    expect(findCommentDensity(counts(10, 4, 4), opts)).toEqual([])
  })
})
