# Material Card Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal material rows with the approved prototype-inspired cards and add local favorite, tags, export, reset-progress, and subtitle-management actions.

**Architecture:** Dexie v2 backfills card metadata on existing materials. `MaterialRepository` exposes focused persistence methods; a pure export mapper removes the audio Blob. `MaterialRow` evolves into the card and owns only menu/modal state. `App` coordinates persistence, download, and a subtitle-only practice route that reuses `PracticeFlow` without advancing learning state.

**Tech Stack:** WXT, React, TypeScript, Dexie/IndexedDB, Vitest, Testing Library, Chrome 114+.

## Global Constraints

- Material cards show progress ring, title, duration, subtitle status, relative added time, study/review round, tags, favorite star, and a more menu.
- Do not implement material collections.
- Tags, favorites, reset state, and export remain local; no account, sync, API key, or audio Blob may be exported.
- Subtitle management reuses the existing sentence editor in a non-progressing mode.
- Reset preserves audio, segments, tags, and favorite; it sets `firstRoundStage` to `blind_listen`, `nextReviewAt` to `null`, `reviewStep` to `0`, and removes retell keywords.
- Reuse existing rename/delete behavior and custom permanent-delete warning.

---

### Task 1: Migrate and expose material-card metadata

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/db/database.ts`
- Modify: `src/db/material-repository.ts`
- Modify: `src/db/__tests__/material-repository.test.ts`

**Interfaces:**
- `Material` gains `isFavorite: boolean` and `tags: string[]`.
- `setFavorite(materialId: string, isFavorite: boolean): Promise<void>`.
- `setTags(materialId: string, tags: string[]): Promise<void>`.
- `resetLearningProgress(materialId: string): Promise<void>`.

- [ ] **Step 1: Write failing repository tests**

```ts
await repository.setFavorite(material.id, true)
await repository.setTags(material.id, ['podcast', 'work'])
await repository.resetLearningProgress(material.id)
expect(await repository.getMaterial(material.id)).toMatchObject({
  isFavorite: true, tags: ['podcast', 'work'], firstRoundStage: 'blind_listen',
  nextReviewAt: null, reviewStep: 0, retellKeywords: undefined,
})
```

Add a migration fixture by inserting a v1-shaped material before reopening the v2 database; assert it reads with `isFavorite: false` and `tags: []`.

- [ ] **Step 2: Run the repository test file and verify failure**

Run: `corepack pnpm test -- src/db/__tests__/material-repository.test.ts`

Expected: FAIL because metadata fields and repository actions do not exist.

- [ ] **Step 3: Add v2 migration and methods**

```ts
this.version(2).stores({
  materials: 'id,status,nextReviewAt,updatedAt,isFavorite,*tags',
  segments: 'id,materialId,[materialId+order],isDifficult',
}).upgrade(async (tx) => {
  await tx.table('materials').toCollection().modify({ isFavorite: false, tags: [] })
})
```

Initialize both fields in `createPending`. Trim tags, remove blanks, de-duplicate while preserving order, and update `updatedAt` in every new repository mutation. `resetLearningProgress` updates only the approved learning fields.

- [ ] **Step 4: Verify repository behavior and typecheck**

Run: `corepack pnpm test -- src/db/__tests__/material-repository.test.ts && corepack pnpm exec tsc --noEmit`

Expected: PASS.

### Task 2: Build the card, menu, tags, export, and reset actions

**Files:**
- Modify: `src/features/library/MaterialRow.tsx`
- Create: `src/features/library/material-export.ts`
- Modify: `src/features/library/__tests__/MaterialRow.test.tsx`
- Create: `src/features/library/__tests__/material-export.test.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`

**Interfaces:**
- `toExportData(material: MaterialWithSegments): Omit<MaterialWithSegments, 'audioBlob'>`.
- `MaterialRow` receives `onToggleFavorite`, `availableTags`, `onSaveTags`, `onExport`, `onResetProgress`, and `onManageSubtitles` in addition to existing actions.

- [ ] **Step 1: Write failing public-seam tests**

```tsx
render(<MaterialRow material={material} actions={<button>开始练习</button>} availableTags={['work']} onRename={onRename} onDelete={onDelete} onToggleFavorite={onToggleFavorite} onSaveTags={onSaveTags} onExport={onExport} onResetProgress={onResetProgress} onManageSubtitles={onManageSubtitles} />)
fireEvent.click(screen.getByRole('button', { name: '收藏 lesson.wav' }))
expect(onToggleFavorite).toHaveBeenCalledWith('m1', true)
fireEvent.click(screen.getByRole('button', { name: '更多操作 lesson.wav' }))
fireEvent.click(screen.getByRole('menuitem', { name: '管理标签' }))
fireEvent.click(screen.getByRole('button', { name: '保存标签' }))
expect(onSaveTags).toHaveBeenCalledWith('m1', expect.any(Array))
```

Add tests that assert the card renders `01:02`, `字幕`, a review label, that export data has no `audioBlob`, and that reset invokes `onResetProgress` only after custom-dialog confirmation.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `corepack pnpm test -- src/features/library/__tests__/MaterialRow.test.tsx src/features/library/__tests__/material-export.test.ts`

Expected: FAIL because the card fields, actions, and export mapper are absent.

- [ ] **Step 3: Implement card presentation and local dialogs**

Use CSS for the circular progress ring; derive its completion from the material stage/review state. Format a known duration as `MM:SS`, derive subtitle status from `status === 'ready'`, and derive added time from `createdAt` without a date library. Render favorite as an accessible toggle. The menu contains, in order: rename, manage subtitles, manage tags, export, reset learning progress, delete. Keep existing delete dialog and add a reset dialog with explicit preservation/clearing copy. The tag dialog must support selecting existing local tags, adding a non-empty trimmed tag, and removing selected tags.

- [ ] **Step 4: Wire App persistence and download behavior**

Derive `availableTags` from all loaded materials. Wire favorite/tag/reset callbacks to the repository then `refresh`. For export, call `getMaterial`, map it with `toExportData`, create a JSON Blob, invoke a temporary anchor download named from the material title, then revoke the object URL. Do not put `audioBlob` into the mapped object.

- [ ] **Step 5: Verify targeted UI/storage behavior and production build**

Run: `corepack pnpm test -- src/features/library/__tests__/MaterialRow.test.tsx src/features/library/__tests__/material-export.test.ts src/db/__tests__/material-repository.test.ts && corepack pnpm build`

Expected: PASS and `.output/chrome-mv3` is emitted.

- [ ] **Step 6: Commit the card-actions slice after approval**

```bash
git add src/domain/types.ts src/db src/features/library src/app/App.tsx src/app/app.css
git commit -m "feat: add material card actions"
```

### Task 3: Reuse the timeline safely for subtitle management

**Files:**
- Modify: `src/features/practice/PracticeFlow.tsx`
- Modify: `src/features/practice/__tests__/PracticeFlow.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `README.md`

**Interfaces:**
- `PracticeFlow` gains `editorOnly?: boolean`.
- In editor-only mode, it renders the audio player and `SegmentEditor`, but no stage rail, retelling prompt, or stage-completion action.

- [ ] **Step 1: Write the failing subtitle-only mode test**

```tsx
render(<PracticeFlow material={materialAt('shadowing')} segments={segments} editorOnly onComplete={vi.fn()} />)
expect(screen.getByText('First transcript sentence')).toBeInTheDocument()
expect(screen.queryByRole('button', { name: /完成/ })).not.toBeInTheDocument()
```

Also assert saving a segment calls only `onSegmentsSaved`, never `onComplete`.

- [ ] **Step 2: Run the focused practice test and verify failure**

Run: `corepack pnpm test -- src/features/practice/__tests__/PracticeFlow.test.tsx`

Expected: FAIL because the editor is hidden outside intensive/shadowing and progression controls are always present.

- [ ] **Step 3: Implement editor-only route coordination**

Track active mode in `App` (`'practice' | 'subtitle_editor'`). The menu's “管理字幕” loads the material in subtitle-editor mode. Pass `editorOnly` to `PracticeFlow`; it must always expose the sentence editor/player but must not call `completeStage` or mutate `firstRoundStage`. Label the page “管理字幕”.

- [ ] **Step 4: Extend manual acceptance and verify all automation**

Add the approved card actions to README's manual checklist. Run:

```bash
corepack pnpm test
corepack pnpm exec tsc --noEmit
corepack pnpm build
```

Expected: all tests pass, typecheck exits zero, and the MV3 build succeeds.

- [ ] **Step 5: Commit subtitle management and documentation after approval**

```bash
git add src/features/practice/PracticeFlow.tsx src/features/practice/__tests__/PracticeFlow.test.tsx src/app/App.tsx README.md
git commit -m "feat: manage subtitles from material cards"
```

## Self-Review

- Coverage: Task 1 covers persistent metadata and migration; Task 2 covers every approved card/menu element except subtitle editor; Task 3 covers that editor and prevents learning-state corruption.
- Privacy: the sole export mapper removes `audioBlob`; no action reads ASR settings or API keys.
- Scope: material collections are explicitly omitted; no sync, recording, scoring, or remote backend is introduced.
- Decision basis: `00-core/principles/the-bitter-lesson.md` supports evolvable, user-authored tag data; it does not justify loosening privacy or local-only boundaries.
