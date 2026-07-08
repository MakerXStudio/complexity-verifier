import { describe, expect, it } from 'vitest'

import { parseDiffAddedLines } from './diff.ts'

const DIFF = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 const x = 1
+const y = 2
 const z = 3
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+export const a = 1
+export const b = 2
`

describe('parseDiffAddedLines', () => {
  it('maps changed files to their added line numbers', () => {
    const added = parseDiffAddedLines(DIFF)
    expect([...(added.get('src/a.ts') ?? [])]).toEqual([2])
    expect([...(added.get('src/new.ts') ?? [])]).toEqual([1, 2])
  })

  it('ignores deletions (/dev/null targets)', () => {
    const del = `--- a/gone.ts\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-const gone = 1\n`
    expect(parseDiffAddedLines(del).size).toBe(0)
  })

  it('returns an empty map for an empty diff', () => {
    expect(parseDiffAddedLines('').size).toBe(0)
  })
})
