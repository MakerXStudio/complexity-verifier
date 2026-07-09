import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

export type ScannedComment = { line: number; text: string }

const YAML_EXTENSIONS = ['.yml', '.yaml']

function isYamlFile(file: string): boolean {
  return YAML_EXTENSIONS.some((ext) => file.endsWith(ext))
}

function scriptKindFor(file: string): ts.ScriptKind {
  return file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}

function scanCodeComments(file: string, content: string): ScannedComment[] {
  const sourceFile = ts.createSourceFile(path.basename(file), content, ts.ScriptTarget.Latest, true, scriptKindFor(file))
  const seen = new Set<number>()
  const out: ScannedComment[] = []
  const addRanges = (ranges: readonly ts.CommentRange[] | undefined): void => {
    for (const range of ranges ?? []) {
      if (seen.has(range.pos)) continue
      seen.add(range.pos)
      const { line } = sourceFile.getLineAndCharacterOfPosition(range.pos)
      out.push({ line: line + 1, text: content.slice(range.pos, range.end) })
    }
  }
  const visit = (node: ts.Node): void => {
    addRanges(ts.getLeadingCommentRanges(content, node.getFullStart()))
    addRanges(ts.getTrailingCommentRanges(content, node.getEnd()))
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  out.sort((a, b) => a.line - b.line)
  return out
}

/** A `#` starts a YAML comment only at line start or after whitespace, and never inside a quoted scalar. */
function scanYamlComments(content: string): ScannedComment[] {
  const out: ScannedComment[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    let inSingle = false
    let inDouble = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === "'" && !inDouble) inSingle = !inSingle
      else if (ch === '"' && !inSingle) inDouble = !inDouble
      else if (ch === '#' && !inSingle && !inDouble && (j === 0 || /\s/.test(line[j - 1] as string))) {
        out.push({ line: i + 1, text: line.slice(j) })
        break
      }
    }
  }
  return out
}

/** Extract every comment (with its 1-based line) from source text, dispatching on the file's extension. */
export function scanComments(file: string, content: string): ScannedComment[] {
  return isYamlFile(file) ? scanYamlComments(content) : scanCodeComments(file, content)
}

/** Extract every comment (with its 1-based line) from a source file, dispatching on extension. */
export function scanFileComments(file: string): ScannedComment[] {
  return scanComments(file, fs.readFileSync(file, 'utf-8'))
}
