import { describe, expect, it } from 'vitest'

import { parsePostToolUsePayload } from './payload.ts'

function json(value: unknown): string {
  return JSON.stringify(value)
}

describe('parsePostToolUsePayload', () => {
  it('parses a Write payload (whole content is added)', () => {
    const raw = json({ tool_name: 'Write', tool_input: { file_path: 'a.ts', content: '// hi\nconst x = 1' } })
    expect(parsePostToolUsePayload(raw)).toEqual({ file: 'a.ts', addedText: '// hi\nconst x = 1' })
  })

  it('parses an Edit payload from new_string', () => {
    const raw = json({ tool_name: 'Edit', tool_input: { file_path: 'a.ts', old_string: 'a', new_string: '// added\nconst y = 2' } })
    expect(parsePostToolUsePayload(raw)).toEqual({ file: 'a.ts', addedText: '// added\nconst y = 2' })
  })

  it('concatenates every MultiEdit new_string', () => {
    const raw = json({
      tool_name: 'MultiEdit',
      tool_input: { file_path: 'a.ts', edits: [{ new_string: '// one' }, { new_string: '// two' }] },
    })
    expect(parsePostToolUsePayload(raw)?.addedText).toBe('// one\n// two')
  })

  it('accepts the `path` key as well as `file_path`', () => {
    const raw = json({ tool_name: 'Write', tool_input: { path: 'a.ts', content: 'const x = 1' } })
    expect(parsePostToolUsePayload(raw)?.file).toBe('a.ts')
  })

  it('returns null for non-file tools, unscanned extensions, empty text, and bad JSON', () => {
    expect(parsePostToolUsePayload(json({ tool_name: 'Bash', tool_input: { command: 'ls' } }))).toBeNull()
    expect(parsePostToolUsePayload(json({ tool_name: 'Write', tool_input: { file_path: 'a.py', content: 'x = 1' } }))).toBeNull()
    expect(parsePostToolUsePayload(json({ tool_name: 'Write', tool_input: { file_path: 'a.ts', content: '   ' } }))).toBeNull()
    expect(parsePostToolUsePayload('not json')).toBeNull()
  })
})
