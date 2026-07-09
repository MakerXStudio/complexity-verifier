import { isScannedExtension } from '../checks/comment-common.ts'

export type HookTarget = { file: string; addedText: string }

type Json = Record<string, unknown>

function asRecord(value: unknown): Json | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : undefined
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

// context: the file path key differs across Claude Code versions/tools (file_path vs path), so we accept either.
function filePathOf(input: Json): string | undefined {
  return str(input.file_path) ?? str(input.path)
}

/** The text an edit operation introduces — new_string / new_str (Edit) across naming variants. */
function newTextOf(op: Json): string {
  return str(op.new_string) ?? str(op.new_str) ?? ''
}

function addedTextFrom(toolName: string, input: Json): string {
  if (toolName === 'Write') return str(input.content) ?? ''
  if (toolName === 'Edit') {
    // Some shapes nest the replacement under operations[]; most carry new_string directly on the input.
    const ops = Array.isArray(input.operations) ? input.operations : []
    const nested = ops
      .map(asRecord)
      .filter((o): o is Json => !!o)
      .map(newTextOf)
    return [newTextOf(input), ...nested].filter(Boolean).join('\n')
  }
  if (toolName === 'MultiEdit') {
    const edits = Array.isArray(input.edits) ? input.edits : []
    return edits
      .map(asRecord)
      .filter((e): e is Json => !!e)
      .map(newTextOf)
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

/**
 * Extract the edited file and the text a PostToolUse Write/Edit/MultiEdit introduced. Returns null when the
 * payload is not a file-editing tool, has no path, targets an unscanned extension, or introduced no text.
 */
export function parsePostToolUsePayload(raw: string): HookTarget | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const payload = asRecord(parsed)
  if (!payload) return null
  const toolName = str(payload.tool_name) ?? ''
  if (!['Write', 'Edit', 'MultiEdit'].includes(toolName)) return null
  const input = asRecord(payload.tool_input)
  if (!input) return null
  const file = filePathOf(input)
  if (!file || !isScannedExtension(file)) return null
  const addedText = addedTextFrom(toolName, input)
  if (addedText.trim() === '') return null
  return { file, addedText }
}
