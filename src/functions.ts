// Function discovery ported from https://github.com/staff0rd/assist/tree/75a75899d7578769a433fb8058c96dd29410c254/src/commands/complexity
import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

const FUNCTION_TYPE_CHECKS: Array<(node: ts.Node) => boolean> = [
  ts.isFunctionDeclaration,
  ts.isFunctionExpression,
  ts.isArrowFunction,
  ts.isMethodDeclaration,
  ts.isGetAccessor,
  ts.isSetAccessor,
  ts.isConstructorDeclaration,
]

type WithBody = {
  body?: ts.Node
} & ts.Node

function hasFunctionBody(node: ts.Node): boolean {
  if (!FUNCTION_TYPE_CHECKS.some((check) => check(node))) return false
  return (node as WithBody).body !== undefined
}

function getIdentifierText(name: ts.Node): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text
  return '<computed>'
}

function getArrowFunctionName(node: ts.ArrowFunction): string {
  const { parent } = node
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text
  return '<arrow>'
}

function getNodeName(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) return node.name?.text ?? '<anonymous>'
  if (ts.isMethodDeclaration(node)) return getIdentifierText(node.name)
  if (ts.isArrowFunction(node)) return getArrowFunctionName(node)
  if (ts.isGetAccessor(node) || ts.isSetAccessor(node)) {
    const prefix = ts.isGetAccessor(node) ? 'get ' : 'set '
    return `${prefix}${getIdentifierText(node.name)}`
  }
  if (ts.isConstructorDeclaration(node)) return 'constructor'
  return '<unknown>'
}

export type FunctionCallback = (file: string, name: string, node: ts.Node) => void

export function forEachFunction(files: readonly string[], callback: FunctionCallback): void {
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const sourceFile = ts.createSourceFile(
      path.basename(file),
      content,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const visit = (node: ts.Node): void => {
      if (hasFunctionBody(node)) callback(file, getNodeName(node), node)
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
}
