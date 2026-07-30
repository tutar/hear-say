# Material Library Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let learners distinguish same-name imports, rename a material in place, and permanently delete a material through a project-styled confirmation dialog.

**Architecture:** `MaterialRepository` owns title uniqueness, title persistence, and existing transactional deletion. A focused `MaterialRow` component owns temporary edit and confirmation-dialog state, while `App` supplies actions and refreshes the material list after persisted changes.

**Tech Stack:** React, TypeScript, Dexie/IndexedDB, Vitest, Testing Library, WXT.

## Global Constraints

- All mutations apply only to extension-local IndexedDB; never rename the computer's source file.
- When an import title already exists, the new display title is `原文件名-ABCD`, with a four-character uppercase letter/digit suffix.
- Renaming trims whitespace and rejects an empty title without persisting.
- Deletion uses a custom dialog, not `window.confirm`, and must display `音频、句子时间轴与学习记录将一并永久删除`.
- Confirmed deletion permanently removes the material Blob, its segments, difficult-sentence flags, and learning state in one transaction; cancellation makes no mutation.
- Both ready and failed materials expose rename and delete controls.
- Do not add batch operations, an undo/recycle bin, source-file renaming, folders, tags, search, sorting, or sync.

---

## Planned File Structure

| Path | Responsibility |
| --- | --- |
| `src/db/material-repository.ts` | Allocate collision-free import titles and persist renamed titles. |
| `src/db/__tests__/material-repository.test.ts` | Verify duplicate naming, rename persistence, and cascaded deletion. |
| `src/features/library/MaterialRow.tsx` | Render a material row with local rename and delete-dialog state. |
| `src/features/library/__tests__/MaterialRow.test.tsx` | Verify edit, cancellation, validation, and delete-confirmation behavior through component props. |
| `src/app/App.tsx` | Route import naming and row actions to the repository, then refresh the library. |
| `src/app/app.css` | Style inline actions and the accessible custom dialog. |

### Task 1: Make material names collision-free and editable in IndexedDB

**Files:**
- Modify: `src/db/material-repository.ts`
- Modify: `src/db/__tests__/material-repository.test.ts`

**Interfaces:**
- Produces `createPending(input): Promise<Material>` with a collision-free `title`.
- Produces `renameMaterial(materialId: string, title: string): Promise<Material>`; it trims `title`, rejects an empty result with `title is required`, and updates `updatedAt`.
- Consumes existing `deleteMaterial(materialId)` transaction.

- [x] **Step 1: Write the failing repository tests for duplicate imports and renaming**

```ts
it('adds a four-character suffix when an imported title already exists', async () => {
  const first = await repository.createPending({ title: 'lesson.wav', audioBlob: new Blob(), durationSeconds: 5 })
  const second = await repository.createPending({ title: 'lesson.wav', audioBlob: new Blob(), durationSeconds: 5 })

  expect(first.title).toBe('lesson.wav')
  expect(second.title).toMatch(/^lesson\.wav-[A-Z0-9]{4}$/)
  expect(second.title).not.toBe(first.title)
})

it('persists a trimmed material name and rejects an empty one', async () => {
  const material = await repository.createPending({ title: 'lesson.wav', audioBlob: new Blob(), durationSeconds: 5 })
  await expect(repository.renameMaterial(material.id, '  podcast clip  ')).resolves.toMatchObject({ title: 'podcast clip' })
  await expect(repository.renameMaterial(material.id, '   ')).rejects.toThrow('title is required')
})
```

- [x] **Step 2: Run the repository tests and verify the new cases fail**

Run: `corepack pnpm test -- src/db/__tests__/material-repository.test.ts`

Expected: FAIL because `createPending` retains duplicate names and `renameMaterial` is absent.

- [x] **Step 3: Add unique-title allocation and rename persistence**

```ts
function randomSuffix(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

async function uniqueTitle(title: string): Promise<string> {
  const existing = new Set((await db.materials.toArray()).map((material) => material.title))
  if (!existing.has(title)) return title
  let candidate = `${title}-${randomSuffix()}`
  while (existing.has(candidate)) candidate = `${title}-${randomSuffix()}`
  return candidate
}
```

Call `uniqueTitle` before inserting a pending material. Implement `renameMaterial` with the trimmed value and a single material update; return the reloaded material and throw `material was not found` if it no longer exists.

- [x] **Step 4: Run the repository test file and typecheck**

Run: `corepack pnpm test -- src/db/__tests__/material-repository.test.ts && corepack pnpm exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit the storage slice after approval**

```bash
git add src/db/material-repository.ts src/db/__tests__/material-repository.test.ts
git commit -m "feat: manage local material names"
```

### Task 2: Add an accessible material-row rename and delete experience

**Files:**
- Create: `src/features/library/MaterialRow.tsx`
- Create: `src/features/library/__tests__/MaterialRow.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`

**Interfaces:**
- Produces `MaterialRow({ material, actions, onRename, onDelete }): JSX.Element`.
- `onRename(materialId, title)` and `onDelete(materialId)` return `Promise<void>` so the row only exits edit/dialog state after successful persistence.
- `actions` is the existing ready-material practice button or failed-material recovery controls, rendered alongside management actions.

- [x] **Step 1: Write the failing row interaction tests**

```tsx
render(<MaterialRow material={material} actions={<button>开始练习</button>} onRename={onRename} onDelete={onDelete} />)
fireEvent.click(screen.getByRole('button', { name: '重命名 lesson.wav' }))
fireEvent.change(screen.getByLabelText('材料名称'), { target: { value: '  revised  ' } })
fireEvent.click(screen.getByRole('button', { name: '保存名称' }))
expect(onRename).toHaveBeenCalledWith('m1', 'revised')

fireEvent.click(screen.getByRole('button', { name: '删除 lesson.wav' }))
expect(screen.getByText('音频、句子时间轴与学习记录将一并永久删除')).toBeInTheDocument()
fireEvent.click(screen.getByRole('button', { name: '取消删除' }))
expect(onDelete).not.toHaveBeenCalled()
```

Add a separate test asserting an empty name displays `材料名称不能为空` and does not call `onRename`, plus one that clicks `确认删除` and expects `onDelete('m1')`.

- [x] **Step 2: Run the component test and verify it fails**

Run: `corepack pnpm test -- src/features/library/__tests__/MaterialRow.test.tsx`

Expected: FAIL because `MaterialRow` does not exist.

- [x] **Step 3: Implement `MaterialRow` with local-only edit/dialog state**

```tsx
type Props = {
  material: Material
  actions: ReactNode
  onRename: (materialId: string, title: string) => Promise<void>
  onDelete: (materialId: string) => Promise<void>
}
```

Use a semantic `<dialog open>` or `role="dialog" aria-modal="true"` for the custom confirmation surface. Keep the exact warning copy. Disable no controls speculatively; handle rejected callbacks by retaining the current edit/dialog state and displaying a concise error. Do not call browser-native confirmation APIs.

- [x] **Step 4: Replace inline material rows in `App` and wire mutations**

```tsx
async function renameMaterial(id: string, title: string) {
  await repository.renameMaterial(id, title)
  await refresh()
}

async function deleteMaterial(id: string) {
  await repository.deleteMaterial(id)
  await refresh()
}
```

Pass the existing ready and recovery controls as `actions`. Use the same `MaterialRow` for every status so failed materials can be managed. Add styles for grouped row actions, inline name editor, error message, dialog backdrop, and destructive confirmation action; preserve the existing responsive material-row layout.

- [x] **Step 5: Run targeted component/repository tests and build**

Run: `corepack pnpm test -- src/features/library/__tests__/MaterialRow.test.tsx src/db/__tests__/material-repository.test.ts && corepack pnpm build`

Expected: PASS and WXT emits `.output/chrome-mv3`.

- [ ] **Step 6: Commit the UI slice after approval**

```bash
git add src/features/library/MaterialRow.tsx src/features/library/__tests__/MaterialRow.test.tsx src/app/App.tsx src/app/app.css
git commit -m "feat: manage audio materials in library"
```

### Task 3: Verify management behavior in the completed extension

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes the completed extension and its existing manual acceptance checklist.
- Produces documented manual checks for duplicate import, rename persistence, and permanent deletion.

- [x] **Step 1: Extend the manual acceptance section**

Add this exact final verification sentence after the existing library-management check:

```markdown
删除确认框应显示“音频、句子时间轴与学习记录将一并永久删除”；取消后材料保持不变，确认后刷新页面也不再出现该材料。
```

- [x] **Step 2: Run full automated verification**

Run: `corepack pnpm test && corepack pnpm exec tsc --noEmit && corepack pnpm build`

Expected: all tests pass, typecheck exits zero, and the production MV3 build succeeds.

- [ ] **Step 3: Perform manual Chrome verification**

Load `.output/chrome-mv3`, import two audio files with the same original filename, and confirm the second display title matches `原文件名-ABCD`. Rename one material, refresh, and confirm the name persists. Delete one material via the custom dialog, confirm the exact warning copy, refresh, and confirm it and its practice data are gone.

- [ ] **Step 4: Commit documentation after approval**

```bash
git add README.md
git commit -m "docs: document material library management"
```

## Self-Review

- Spec coverage: Task 1 covers duplicate-name allocation and local persistence; Task 2 covers original-file preservation, inline rename, custom confirmation, ready/failed availability, and atomic deletion; Task 3 covers documented automated and manual verification.
- Scope: no batch actions, undo, source-file mutation, organization features, or sync is introduced.
- Type consistency: all UI callbacks use `materialId: string`; the repository returns `Material`; title collision handling occurs before `createPending` persists the material.
- No-placeholder scan: every test, mutation, command, copy string, and file target is specified.
