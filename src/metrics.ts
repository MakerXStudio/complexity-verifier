// Metric calculations ported from https://github.com/staff0rd/assist/tree/75a75899d7578769a433fb8058c96dd29410c254/src/commands/complexity
import ts from 'typescript'

const complexityKinds = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.CatchClause,
  ts.SyntaxKind.ConditionalExpression,
])

const logicalOperators = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
])

export function calculateCyclomaticComplexity(node: ts.Node): number {
  let complexity = 1
  const visit = (n: ts.Node): void => {
    if (complexityKinds.has(n.kind)) {
      complexity++
    } else if (ts.isBinaryExpression(n) && logicalOperators.has(n.operatorToken.kind)) {
      complexity++
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(node, visit)
  return complexity
}

const operatorChecks: Array<(n: ts.Node) => string | undefined> = [
  (n) => (ts.isBinaryExpression(n) ? n.operatorToken.getText() : undefined),
  (n) => (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n) ? (ts.tokenToString(n.operator) ?? '') : undefined),
  (n) => (ts.isCallExpression(n) ? '()' : undefined),
  (n) => (ts.isPropertyAccessExpression(n) ? '.' : undefined),
  (n) => (ts.isElementAccessExpression(n) ? '[]' : undefined),
  (n) => (ts.isConditionalExpression(n) ? '?:' : undefined),
  (n) => (ts.isReturnStatement(n) ? 'return' : undefined),
  (n) => (ts.isIfStatement(n) ? 'if' : undefined),
  (n) => (ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n) ? 'for' : undefined),
  (n) => (ts.isWhileStatement(n) ? 'while' : undefined),
  (n) => (ts.isDoStatement(n) ? 'do' : undefined),
  (n) => (ts.isSwitchStatement(n) ? 'switch' : undefined),
  (n) => (ts.isCaseClause(n) ? 'case' : undefined),
  (n) => (ts.isDefaultClause(n) ? 'default' : undefined),
  (n) => (ts.isBreakStatement(n) ? 'break' : undefined),
  (n) => (ts.isContinueStatement(n) ? 'continue' : undefined),
  (n) => (ts.isThrowStatement(n) ? 'throw' : undefined),
  (n) => (ts.isTryStatement(n) ? 'try' : undefined),
  (n) => (ts.isCatchClause(n) ? 'catch' : undefined),
  (n) => (ts.isNewExpression(n) ? 'new' : undefined),
  (n) => (ts.isTypeOfExpression(n) ? 'typeof' : undefined),
  (n) => (ts.isAwaitExpression(n) ? 'await' : undefined),
]

function classifyNode(n: ts.Node, operators: Map<string, number>, operands: Map<string, number>): void {
  if (ts.isIdentifier(n) || ts.isNumericLiteral(n) || ts.isStringLiteral(n)) {
    operands.set(n.text, (operands.get(n.text) ?? 0) + 1)
    return
  }
  for (const check of operatorChecks) {
    const op = check(n)
    if (op !== undefined) {
      operators.set(op, (operators.get(op) ?? 0) + 1)
      return
    }
  }
}

export type HalsteadMetrics = {
  volume: number
  difficulty: number
  effort: number
}

export function calculateHalstead(node: ts.Node): HalsteadMetrics {
  const operators = new Map<string, number>()
  const operands = new Map<string, number>()
  const visit = (n: ts.Node): void => {
    classifyNode(n, operators, operands)
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(node, visit)

  const n1 = operators.size
  const n2 = operands.size
  const N1 = Array.from(operators.values()).reduce((a, b) => a + b, 0)
  const N2 = Array.from(operands.values()).reduce((a, b) => a + b, 0)
  const vocabulary = n1 + n2
  const length = N1 + N2
  const volume = length > 0 && vocabulary > 0 ? length * Math.log2(vocabulary) : 0
  const difficulty = n2 > 0 ? (n1 / 2) * (N2 / n2) : 0
  return { volume, difficulty, effort: volume * difficulty }
}

export function countSloc(content: string): number {
  let inMultiLineComment = false
  let count = 0
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (inMultiLineComment) {
      if (trimmed.includes('*/')) {
        inMultiLineComment = false
        const afterComment = trimmed.substring(trimmed.indexOf('*/') + 2)
        if (afterComment.trim().length > 0) count++
      }
      continue
    }
    if (trimmed.startsWith('//')) continue
    if (trimmed.startsWith('/*')) {
      if (trimmed.includes('*/')) {
        const afterComment = trimmed.substring(trimmed.indexOf('*/') + 2)
        if (afterComment.trim().length > 0) count++
      } else {
        inMultiLineComment = true
      }
      continue
    }
    if (trimmed.length > 0) count++
  }
  return count
}

export function calculateMaintainabilityIndex(halsteadVolume: number, cyclomaticComplexity: number, sloc: number): number {
  if (halsteadVolume === 0 || sloc === 0) return 100
  const mi = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(sloc)
  return Math.max(0, Math.min(100, mi))
}
