# Audio Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the private Chrome extension full-page feature that imports local English audio, creates an editable sentence timeline, and guides a learner through the first listening-and-speaking loop.

**Architecture:** A WXT Manifest V3 extension opens a React full-page application from the toolbar action. Pure TypeScript domain modules validate ASR/subtitle input, edit segments, schedule reviews, and control stage transitions; React coordinates those modules with a Dexie-backed IndexedDB repository. Audio is stored as a Blob locally; the only network operation is a user-initiated upload to the configured ASR endpoint after Chrome grants that endpoint origin permission.

**Tech Stack:** Chrome 114+, Manifest V3, WXT, React, TypeScript, Dexie/IndexedDB, Vitest, Testing Library, fake-indexeddb, pnpm.

## Global Constraints

- Build only the `Audio Learning Loop` feature; do not implement web selection, translation, vocabulary cards, wordbook, Side Panel, tab capture, recording, scoring, or background listening.
- Target Chrome 114+ and Manifest V3; provide a full extension page and no Popup.
- Store every audio Blob, material record, segment, difficult-sentence flag, and learning state locally in IndexedDB.
- Default ASR settings are `http://localhost:8021/v1`, an empty API key, and `sensevoice`; requests use `POST /audio/transcriptions` with `response_format=verbose_json`.
- Treat timestamps as sentence-level only. Reject a segment unless `0 <= startSeconds < endSeconds <= durationSeconds` when duration is known.
- Upload only an audio Blob explicitly selected by the user. Do not upload page URLs, titles, browsing history, or API keys.
- Keep API keys in extension-local storage only; never render, export, or log them.
- On ASR or subtitle failure, retain the original material and expose retry/import-subtitle recovery. An invalid subtitle must not overwrite existing usable segments.
- The first-round order is `blind_listen → intensive_listen → shadowing → retelling → complete`; completing the round schedules review at six hours, then `1 → 2 → 4 → 7 → 14 → 28` days.

---

## Planned File Structure

| Path | Responsibility |
| --- | --- |
| `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts` | WXT/React build, extension manifest, and test commands. |
| `entrypoints/background.ts` | Opens the full page when the toolbar action is clicked. |
| `entrypoints/app.html`, `entrypoints/app/main.tsx` | WXT extension-page entrypoint and React mount. |
| `src/domain/types.ts` | Shared persisted and UI-domain types. |
| `src/domain/segments.ts` | Segment validation, text/timing edits, adjacent merge, and explicit split. |
| `src/domain/asr.ts` | `verbose_json` normalization and user-facing error classification. |
| `src/domain/subtitles.ts` | SRT/VTT parsing into validated candidate segments. |
| `src/domain/learning.ts` | First-round state transitions and fixed review scheduling. |
| `src/services/asr-client.ts` | Chrome-origin permission request and multipart ASR request. |
| `src/services/settings.ts` | Local persistence for ASR settings. |
| `src/db/database.ts`, `src/db/material-repository.ts` | Dexie schema and atomic persistence operations. |
| `src/app/App.tsx`, `src/app/app.css` | Top-level route/state shell and local-only UI styling. |
| `src/features/library/*` | Import, status, retry, and material-library UI. |
| `src/features/practice/*` | Audio player, editable timeline, and four-stage practice UI. |
| `src/test/setup.ts`, `src/**/__tests__/*.test.ts(x)` | Unit and component tests. |
| `README.md` | Local development, load-unpacked, ASR configuration, and manual acceptance instructions. |

### Task 1: Scaffold the WXT extension and verify the full-page entrypoint

**Files:**
- Create: `package.json`
- Create: `wxt.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `entrypoints/background.ts`
- Create: `entrypoints/app.html`
- Create: `entrypoints/app/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/app.css`
- Create: `src/test/setup.ts`
- Create: `src/app/__tests__/App.test.tsx`

**Interfaces:**
- Produces: `App(): JSX.Element`, an extension page at `/app.html`, and a toolbar action that opens it in a normal tab.
- Produces npm scripts: `dev`, `build`, `test`, and `test:watch`.

- [ ] **Step 1: Initialize the package manifest and install the exact development tool categories**

Create a pnpm project using WXT React dependencies (`wxt`, `@wxt-dev/module-react`, `react`, `react-dom`) and development dependencies (`typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `fake-indexeddb`, React type packages). Add these scripts:

```json
{
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Configure the extension manifest and test environment**

Configure WXT with the React module, `manifest_version: 3`, `action: { default_title: 'Hear & Say' }`, `permissions: ['storage']`, and `optional_host_permissions: ['http://*/*', 'https://*/*']`. Configure Vitest with `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, and a `@` alias to `src`. Put `import '@testing-library/jest-dom/vitest'` and `import 'fake-indexeddb/auto'` in the setup file.

- [ ] **Step 3: Write the failing entrypoint test**

```tsx
import { render, screen } from '@testing-library/react'
import { App } from '@/app/App'

it('renders the private audio-learning entrypoint', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Hear & Say' })).toBeInTheDocument()
  expect(screen.getByText('Audio Learning Loop')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run the test to verify it fails before the component exists**

Run: `pnpm test src/app/__tests__/App.test.tsx`

Expected: FAIL because `@/app/App` cannot be resolved.

- [ ] **Step 5: Implement the smallest full-page React shell and toolbar behavior**

Mount `App` from `entrypoints/app/main.tsx`; make `App` render the tested heading and feature label. In `entrypoints/background.ts`, register an action click listener which opens `browser.runtime.getURL('/app.html')` with `browser.tabs.create`. Use a minimal CSS reset and local layout only; do not add analytics or remote assets.

```ts
browser.action.onClicked.addListener(async () => {
  await browser.tabs.create({ url: browser.runtime.getURL('/app.html') })
})
```

- [ ] **Step 6: Run unit and production-build verification**

Run: `pnpm test src/app/__tests__/App.test.tsx && pnpm build`

Expected: test passes and WXT emits an unpacked Chrome build under `.output/chrome-mv3/`.

- [ ] **Step 7: Commit the scaffold**

```bash
git add package.json pnpm-lock.yaml wxt.config.ts tsconfig.json vitest.config.ts .gitignore entrypoints src
git commit -m "feat: scaffold Hear and Say extension"
```

### Task 2: Define and test the domain model, segment editing, and learning state machine

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/segments.ts`
- Create: `src/domain/learning.ts`
- Create: `src/domain/__tests__/segments.test.ts`
- Create: `src/domain/__tests__/learning.test.ts`

**Interfaces:**
- Produces: `validateSegment`, `updateSegment`, `mergeAdjacentSegments`, and `splitSegment` from `segments.ts`.
- Produces: `completeStage(material, completedAt)`, `advanceReview(material, completedAt)`, and `REVIEW_INTERVAL_DAYS` from `learning.ts`.
- Consumes: `Material` and `Segment` exactly as defined in the approved specification.

- [ ] **Step 1: Write failing segment-editing tests**

```ts
expect(() => validateSegment({ ...segment, endSeconds: 1 }, 10)).toThrow('end must be after start')
expect(mergeAdjacentSegments([first, second], first.id)).toMatchObject({
  startSeconds: 0, endSeconds: 4, text: 'First. Second.'
})
expect(splitSegment(segment, { atSeconds: 2, leftText: 'First', rightText: 'Second' }, 8))
  .toHaveLength(2)
```

- [ ] **Step 2: Run the segment test to verify it fails**

Run: `pnpm test src/domain/__tests__/segments.test.ts`

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 3: Implement immutable segment operations with explicit validation**

Define `MaterialStatus`, `Segment`, `Material`, `AsrSettings`, `FirstRoundStage`, and `ReviewState` in `types.ts`. Require `splitSegment` to receive `{ atSeconds, leftText, rightText }`, create two new ordered segments, and reject a split point outside the original segment. Require `mergeAdjacentSegments` to merge only the identified segment and its next `order` neighbor; renumber every returned segment consecutively.

```ts
export function validateSegment(segment: Segment, durationSeconds: number | null): Segment {
  if (!Number.isFinite(segment.startSeconds) || !Number.isFinite(segment.endSeconds)) throw new Error('timestamps must be finite')
  if (segment.startSeconds < 0 || segment.endSeconds <= segment.startSeconds) throw new Error('end must be after start')
  if (durationSeconds !== null && segment.endSeconds > durationSeconds) throw new Error('end exceeds duration')
  if (!segment.text.trim()) throw new Error('text is required')
  return segment
}
```

- [ ] **Step 4: Write failing learning-flow tests**

```ts
expect(() => completeStage(materialAt('blind_listen'), date)).toThrow('stage is not completeable')
expect(completeStage(materialAt('blind_listen'), date).firstRoundStage).toBe('intensive_listen')
const complete = completeStage(materialAt('retelling'), date)
expect(complete).toMatchObject({ firstRoundStage: 'complete', nextReviewAt: '2026-07-30T06:00:00.000Z' })
expect(advanceReview(complete, new Date('2026-07-30T06:00:00.000Z')).nextReviewAt)
  .toBe('2026-07-31T06:00:00.000Z')
```

- [ ] **Step 5: Implement legal transitions and fixed review intervals**

Use `['blind_listen', 'intensive_listen', 'shadowing', 'retelling', 'complete']` as the sole stage order. `completeStage` advances only one stage; only completing `retelling` sets the first six-hour review timestamp. Store a numeric `reviewStep` in `Material` so `advanceReview` can successively schedule 1, 2, 4, 7, 14, and 28 days after a completed review; after the last interval, keep the final 28-day cadence.

- [ ] **Step 6: Run all domain tests**

Run: `pnpm test src/domain/__tests__/segments.test.ts src/domain/__tests__/learning.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the domain layer**

```bash
git add src/domain
git commit -m "feat: add learning domain rules"
```

### Task 3: Normalize ASR and subtitle inputs without losing a recoverable material

**Files:**
- Create: `src/domain/asr.ts`
- Create: `src/domain/subtitles.ts`
- Create: `src/domain/__tests__/asr.test.ts`
- Create: `src/domain/__tests__/subtitles.test.ts`

**Interfaces:**
- Produces: `normalizeVerboseJson(payload, materialId, durationSeconds): Segment[]`.
- Produces: `parseSubtitle(text, format, materialId, durationSeconds): Segment[]`, where `format` is `'srt' | 'vtt'`.
- Consumes: `validateSegment(segment, durationSeconds)` from `segments.ts`.

- [ ] **Step 1: Write failing ASR-normalization tests**

```ts
expect(normalizeVerboseJson({ segments: [{ start: 0, end: 1.2, text: ' Hello ' }] }, 'm1', 3))
  .toMatchObject([{ materialId: 'm1', order: 0, text: 'Hello', startSeconds: 0, endSeconds: 1.2 }])
expect(() => normalizeVerboseJson({ segments: [] }, 'm1', 3)).toThrow('no usable sentence segments')
expect(() => normalizeVerboseJson({ segments: [{ start: 2, end: 1, text: 'bad' }] }, 'm1', 3))
  .toThrow('end must be after start')
```

- [ ] **Step 2: Run the ASR test to verify it fails**

Run: `pnpm test src/domain/__tests__/asr.test.ts`

Expected: FAIL because `normalizeVerboseJson` is not implemented.

- [ ] **Step 3: Implement strict `verbose_json` normalization**

Read only `payload.segments`. Convert finite numeric `start`/`end` and trimmed non-empty `text` into a new `Segment`, generate `crypto.randomUUID()` ids, set `isDifficult: false`, then validate every segment. Reject a missing/non-array `segments` field and reject an input that produces no usable segment.

- [ ] **Step 4: Write failing subtitle parsing tests**

```ts
const srt = '1\n00:00:00,000 --> 00:00:01,500\nHello there\n'
expect(parseSubtitle(srt, 'srt', 'm1', 3)[0]).toMatchObject({ text: 'Hello there', endSeconds: 1.5 })
expect(() => parseSubtitle('WEBVTT\n\n00:00:03.000 --> 00:00:01.000\nBad', 'vtt', 'm1', 4))
  .toThrow('end must be after start')
```

- [ ] **Step 5: Implement SRT and VTT parsers with complete pre-write validation**

Support SRT comma timestamps and VTT dot timestamps. Ignore cue identifiers and `WEBVTT` header; join multi-line cue text with a single space. Validate all candidate segments before returning any. Reject invalid ordering or an empty valid cue set so callers never replace current usable segments with partial input.

- [ ] **Step 6: Run the input-normalization tests**

Run: `pnpm test src/domain/__tests__/asr.test.ts src/domain/__tests__/subtitles.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit ASR and subtitle domain logic**

```bash
git add src/domain
git commit -m "feat: normalize transcript inputs"
```

### Task 4: Add local settings, optional-origin permission, and multipart ASR client

**Files:**
- Create: `src/services/settings.ts`
- Create: `src/services/asr-client.ts`
- Create: `src/services/__tests__/settings.test.ts`
- Create: `src/services/__tests__/asr-client.test.ts`

**Interfaces:**
- Produces: `DEFAULT_ASR_SETTINGS`, `loadAsrSettings(): Promise<AsrSettings>`, and `saveAsrSettings(settings): Promise<void>`.
- Produces: `transcribeAudio(input): Promise<Segment[]>`, where `input` is `{ audioBlob: Blob; filename: string; materialId: string; durationSeconds: number | null; settings: AsrSettings }`.
- Consumes: `normalizeVerboseJson` and returns its normalized `Segment[]` result.

- [ ] **Step 1: Write failing settings and request-shape tests**

```ts
expect(await loadAsrSettings()).toEqual({ baseUrl: 'http://localhost:8021/v1', apiKey: '', model: 'sensevoice' })
await saveAsrSettings({ baseUrl: 'https://asr.example/v1/', apiKey: 'secret', model: 'custom' })
expect(await loadAsrSettings()).toMatchObject({ baseUrl: 'https://asr.example/v1', model: 'custom' })

await transcribeAudio(input)
expect(fetch).toHaveBeenCalledWith('http://localhost:8021/v1/audio/transcriptions', expect.objectContaining({ method: 'POST' }))
```

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `pnpm test src/services/__tests__/settings.test.ts src/services/__tests__/asr-client.test.ts`

Expected: FAIL because the service modules do not exist.

- [ ] **Step 3: Implement settings persistence and explicit host permission**

Use `browser.storage.local` for the one `asrSettings` object. Normalize a trailing slash from `baseUrl`; reject a non-HTTP(S) URL. Before fetching, derive an origin pattern such as `http://localhost:8021/*`, check `browser.permissions.contains`, then call `browser.permissions.request({ origins: [originPattern] })`. If the user declines, throw `new Error('ASR endpoint permission was not granted')` without creating a request.

- [ ] **Step 4: Implement multipart transcription and safe errors**

Append `file`, `model`, and `response_format: 'verbose_json'` to `FormData`. Add an `Authorization: Bearer …` header only when `apiKey` is non-empty. Convert non-2xx, network, invalid JSON, and normalization failures into errors that name the recovery action but never include the API key or audio body.

```ts
const body = new FormData()
body.append('file', input.audioBlob, input.filename)
body.append('model', input.settings.model)
body.append('response_format', 'verbose_json')
```

- [ ] **Step 5: Run the settings and ASR-client tests**

Run: `pnpm test src/services/__tests__/settings.test.ts src/services/__tests__/asr-client.test.ts`

Expected: PASS, including a rejected-permission test and a `verbose_json` response test.

- [ ] **Step 6: Commit local ASR services**

```bash
git add src/services
git commit -m "feat: add local ASR configuration"
```

### Task 5: Persist materials and segments in IndexedDB

**Files:**
- Create: `src/db/database.ts`
- Create: `src/db/material-repository.ts`
- Create: `src/db/__tests__/material-repository.test.ts`

**Interfaces:**
- Produces: `MaterialRepository` methods `createPending`, `listMaterials`, `getMaterial`, `replaceSegments`, `markTranscriptionFailed`, `markReady`, `saveMaterial`, and `deleteMaterial`.
- Consumes: `Material`, `Segment`, and `MaterialStatus` from `types.ts`.

- [ ] **Step 1: Write the failing repository persistence tests**

```ts
const created = await repository.createPending({ title: 'clip.wav', audioBlob: blob, durationSeconds: 5 })
await repository.markTranscriptionFailed(created.id, 'ASR is unreachable')
expect(await repository.getMaterial(created.id)).toMatchObject({ status: 'transcription_failed', audioBlob: blob })
await repository.replaceSegments(created.id, [segment])
expect((await repository.getMaterial(created.id))?.segments).toHaveLength(1)
```

- [ ] **Step 2: Run the repository test to verify it fails**

Run: `pnpm test src/db/__tests__/material-repository.test.ts`

Expected: FAIL because the database and repository do not exist.

- [ ] **Step 3: Implement the version-one Dexie schema**

Create `HearSayDatabase` with `materials: 'id,status,nextReviewAt,updatedAt'` and `segments: 'id,materialId,[materialId+order],isDifficult'`. Add a `resetDatabaseForTest` helper available only to tests. Store the Blob directly in the material record.

- [ ] **Step 4: Implement atomic material lifecycle methods**

`createPending` generates an id and timestamps, sets `status: 'pending_transcription'`, `firstRoundStage: 'blind_listen'`, `reviewStep: 0`, and null error/review time. `replaceSegments` must run in a read-write transaction, delete only that material's existing segments, write the fully validated replacement list, and mark the material `ready`. `markTranscriptionFailed` changes status/error but never removes the Blob or segments. `deleteMaterial` deletes the material and all its segments in one transaction.

- [ ] **Step 5: Expand tests for reload semantics and deletion**

Create a second repository instance against the same test database, read the previously saved material and segment, then delete it and assert neither records remain. This verifies refresh persistence and cleanup.

- [ ] **Step 6: Run repository tests**

Run: `pnpm test src/db/__tests__/material-repository.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the storage layer**

```bash
git add src/db
git commit -m "feat: persist local learning materials"
```

### Task 6: Build the library, ASR settings, import, retry, and subtitle-recovery interface

**Files:**
- Create: `src/features/library/AsrSettingsForm.tsx`
- Create: `src/features/library/MaterialImportForm.tsx`
- Create: `src/features/library/MaterialLibrary.tsx`
- Create: `src/features/library/library-controller.ts`
- Create: `src/features/library/__tests__/MaterialLibrary.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`

**Interfaces:**
- Consumes: `MaterialRepository`, `transcribeAudio`, `parseSubtitle`, `loadAsrSettings`, and `saveAsrSettings`.
- Produces: `MaterialLibrary({ onOpenMaterial: (materialId: string) => void }): JSX.Element`.
- Produces: `LibraryController.importAudio(file): Promise<void>`, `retry(materialId): Promise<void>`, and `importSubtitle(materialId, file): Promise<void>`.

- [ ] **Step 1: Write failing component tests for import and recovery actions**

```tsx
render(<MaterialLibrary onOpenMaterial={vi.fn()} />)
await user.upload(screen.getByLabelText('Audio file'), new File(['audio'], 'lesson.wav', { type: 'audio/wav' }))
await user.click(screen.getByRole('button', { name: 'Import and transcribe' }))
expect(await screen.findByText('Transcribing')).toBeInTheDocument()

renderFailedMaterial()
expect(screen.getByRole('button', { name: 'Retry transcription' })).toBeInTheDocument()
expect(screen.getByLabelText('SRT or VTT subtitle')).toBeInTheDocument()
```

- [ ] **Step 2: Run the library test to verify it fails**

Run: `pnpm test src/features/library/__tests__/MaterialLibrary.test.tsx`

Expected: FAIL because the library feature does not exist.

- [ ] **Step 3: Implement a controller that preserves recovery state**

On import, compute duration via a temporary `HTMLAudioElement`, call `createPending` before ASR, then call `transcribeAudio`; on success call `replaceSegments`; on error call `markTranscriptionFailed`. On retry, use the stored Blob and existing filename/title. On subtitle import, parse and validate the entire file before `replaceSegments`. Never call `replaceSegments` after a parsing exception.

- [ ] **Step 4: Implement the library UI and settings form**

Render a local-only settings form with Base URL, API key password input, and model. Render statuses as `Ready`, `Transcribing`, or `Transcription failed`, with the retry and subtitle controls only for failed materials. Show a material's title, updated time, next review time when set, and an `Open practice` action only when ready.

- [ ] **Step 5: Run library tests and build**

Run: `pnpm test src/features/library/__tests__/MaterialLibrary.test.tsx && pnpm build`

Expected: PASS and build succeeds.

- [ ] **Step 6: Commit the material library**

```bash
git add src/features/library src/app
git commit -m "feat: add audio import and recovery"
```

### Task 7: Build an editable, sentence-level audio timeline

**Files:**
- Create: `src/features/practice/AudioPlayer.tsx`
- Create: `src/features/practice/SegmentEditor.tsx`
- Create: `src/features/practice/practice-controller.ts`
- Create: `src/features/practice/__tests__/SegmentEditor.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`

**Interfaces:**
- Consumes: `getMaterial`, `saveMaterial`, `replaceSegments`, `updateSegment`, `mergeAdjacentSegments`, and `splitSegment`.
- Produces: `SegmentEditor({ material, segments, onSegmentsSaved }): JSX.Element`.
- Produces: `AudioPlayer({ audioBlob, activeSegment, playbackRate, loop }): JSX.Element`.

- [ ] **Step 1: Write failing segment-editor interaction tests**

```tsx
render(<SegmentEditor material={material} segments={[first, second]} onSegmentsSaved={onSegmentsSaved} />)
await user.clear(screen.getByLabelText('Segment 1 text'))
await user.type(screen.getByLabelText('Segment 1 text'), 'Revised text')
await user.click(screen.getByRole('button', { name: 'Save segment 1' }))
expect(onSegmentsSaved).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ text: 'Revised text' })]))

await user.click(screen.getByRole('button', { name: 'Merge segment 1 with next' }))
expect(onSegmentsSaved).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ endSeconds: second.endSeconds })]))
```

- [ ] **Step 2: Run the editor test to verify it fails**

Run: `pnpm test src/features/practice/__tests__/SegmentEditor.test.tsx`

Expected: FAIL because the practice editor does not exist.

- [ ] **Step 3: Implement the player with segment playback, looping, and speed**

Use an `<audio controls>` element sourced from `URL.createObjectURL(audioBlob)` and revoke its URL on cleanup. When a segment is selected, set `currentTime` to `startSeconds`; pause at `endSeconds`, or seek to the start when loop is enabled. Offer rates `0.75`, `1`, and `1.25`; do not record microphone audio.

- [ ] **Step 4: Implement explicit edit, merge, split, timing, and difficult-sentence controls**

Each segment row has labelled text, start, and end fields; validate through `updateSegment` before persisting. The merge button exists only when a next segment exists. The split form asks for split seconds, left text, and right text, then invokes `splitSegment`. A checkbox toggles `isDifficult`. Persist every successful edit by replacing the material's entire validated segment list.

- [ ] **Step 5: Add and run boundary tests**

Add a test that entering an end time equal to the start displays `end must be after start` and does not call `onSegmentsSaved`. Add a test that a difficult-sentence toggle persists its changed `isDifficult` value.

Run: `pnpm test src/features/practice/__tests__/SegmentEditor.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit editable timeline support**

```bash
git add src/features/practice src/app
git commit -m "feat: add editable sentence timeline"
```

### Task 8: Implement the four-stage practice flow and review queue

**Files:**
- Create: `src/features/practice/PracticeFlow.tsx`
- Create: `src/features/practice/ReviewQueue.tsx`
- Create: `src/features/practice/__tests__/PracticeFlow.test.tsx`
- Modify: `src/features/practice/practice-controller.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`

**Interfaces:**
- Consumes: `completeStage`, `advanceReview`, `MaterialRepository.saveMaterial`, and practice-player/editor components.
- Produces: `PracticeFlow({ materialId, onBack }): JSX.Element` and `ReviewQueue({ onOpenMaterial }): JSX.Element`.

- [ ] **Step 1: Write failing stage-visibility and transition tests**

```tsx
render(<PracticeFlow materialId="m1" onBack={vi.fn()} />)
expect(screen.queryByText('First transcript sentence')).not.toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Complete blind listening' }))
expect(await screen.findByText('Intensive listening')).toBeInTheDocument()
expect(screen.getByText('First transcript sentence')).toBeInTheDocument()
```

- [ ] **Step 2: Run the practice-flow test to verify it fails**

Run: `pnpm test src/features/practice/__tests__/PracticeFlow.test.tsx`

Expected: FAIL because `PracticeFlow` is not implemented.

- [ ] **Step 3: Implement all four learning screens using the persisted state machine**

Blind listening shows only the player and completion control. Intensive listening shows the editor/player. Shadowing shows player, looping, speed selection, and a self-confirmation button. Retelling hides transcript text and presents title plus user-selected keyword hints derived from editable per-material local input; it never records or scores speech. Call `completeStage` only from each stage's labelled confirmation action and persist the returned material.

- [ ] **Step 4: Implement first completion and due-review behavior**

After retelling, display the next-review timestamp. `ReviewQueue` queries ready materials whose `nextReviewAt` is at or before the current time, sorts difficult materials first, and labels their difficult segment count. A `Complete review` control calls `advanceReview` and persists the next fixed interval.

- [ ] **Step 5: Add tests for complete and review paths**

Test that retelling completion writes `firstRoundStage: 'complete'` and six-hour `nextReviewAt`. Test a due material with a difficult segment appears before a due material without one. Test completion advances a due review by one day.

- [ ] **Step 6: Run all practice tests and the full test suite**

Run: `pnpm test src/features/practice/__tests__/PracticeFlow.test.tsx src/features/practice/__tests__/SegmentEditor.test.tsx && pnpm test`

Expected: PASS.

- [ ] **Step 7: Commit learning flow and review queue**

```bash
git add src/features/practice src/app
git commit -m "feat: add four-stage audio practice"
```

### Task 9: Document and verify the extension against the approved acceptance path

**Files:**
- Create: `README.md`
- Modify: `src/services/asr-client.ts`
- Modify: `src/features/library/MaterialLibrary.tsx`
- Test: `src/services/__tests__/asr-client.test.ts`

**Interfaces:**
- Consumes: completed extension build and ASR client.
- Produces: reproducible local setup, security boundary, test commands, and manual acceptance checklist.

- [ ] **Step 1: Write a failing ASR-error redaction test**

```ts
await expect(transcribeAudio({ ...input, settings: { ...input.settings, apiKey: 'secret-key' } })).rejects
  .not.toThrow('secret-key')
```

- [ ] **Step 2: Run the redaction test to verify it fails or exposes the current error text**

Run: `pnpm test src/services/__tests__/asr-client.test.ts`

Expected: the test identifies any error path that includes the API key.

- [ ] **Step 3: Remove API-key exposure from every surfaced request error**

Ensure the ASR client error strings only contain the endpoint origin/path, HTTP status, or a fixed recovery message. Ensure `MaterialLibrary` renders a failure summary and retry/subtitle actions, never a request object or API key.

- [ ] **Step 4: Write the project README**

Document these exact sections: prerequisites (Node LTS, pnpm, Chrome 114+), `pnpm install`, `pnpm dev`, loading `.output/chrome-mv3` as an unpacked extension, toolbar opening behavior, default FunASR configuration, why Chrome asks for ASR-origin permission, `pnpm test`, `pnpm build`, data-locality/API-key boundary, and the six manual acceptance steps from the approved feature specification.

- [ ] **Step 5: Run final automated verification**

Run: `pnpm test && pnpm build`

Expected: every unit/component test passes and the MV3 production build succeeds.

- [ ] **Step 6: Perform the manual Chrome acceptance path**

Load `.output/chrome-mv3` in Chrome, open the extension from its toolbar icon, import a real English audio file with local FunASR `sensevoice`, edit text, merge/split/tune a timestamp, mark a difficult sentence, complete all four stages, refresh the extension page, and verify persisted state. Then set an unreachable ASR URL, import another audio file, verify it remains retryable, and import a valid SRT/VTT subtitle as recovery.

- [ ] **Step 7: Commit documentation and final hardening**

```bash
git add README.md src/services/asr-client.ts src/services/__tests__/asr-client.test.ts src/features/library/MaterialLibrary.tsx
git commit -m "docs: add Hear and Say usage guide"
```

### Task 10: Make ASR upload progress unmistakable

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`
- Create: `src/features/library/AudioImportControl.tsx`
- Create: `src/features/library/__tests__/AudioImportControl.test.tsx`

**Interfaces:**
- Produces an import control that is disabled while `importFile` awaits the controller.
- Produces visible copy `正在转写音频，这可能需要一点时间…` and a CSS spinner only during that request.

- [x] **Step 1: Write the failing loading-state test**

Render `AudioImportControl` with `isImporting` directly. Assert the file input is disabled, the loading copy is visible, and the spinner has `role="status"`; assert the idle control remains enabled and does not render the copy.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `corepack pnpm test -- src/features/library/__tests__/AudioImportControl.test.tsx`

Expected: FAIL because the import UI has no importing state.

- [x] **Step 3: Implement request-scoped importing state**

Create `AudioImportControl({ isImporting, onSelectFile })`. Set `isImporting` in `App` before duration lookup/transcription and clear it in `finally`; pass it to the control. Disable the file input and render the spinner/copy while true. Preserve existing success and failure messages.

- [x] **Step 4: Verify the focused test, full suite, typecheck, and build**

Run: `corepack pnpm test && corepack pnpm exec tsc --noEmit && corepack pnpm build`

Expected: PASS and a Chrome MV3 build under `.output/chrome-mv3`.

## Self-Review

- Spec coverage: Tasks 1–9 cover all included capability groups: full-page local import, local storage, configurable compatible ASR, sentence timeline normalization and edits, four learning stages, difficult sentences and fixed reviews, retry/SRT/VTT recovery, automated tests, and Chrome manual acceptance.
- Explicit exclusions remain excluded: no content-script/page capture, Side Panel, microphone recording, speech evaluation, word timing, vocabulary/wordbook, cloud account, backend, sync, or analytics appears in the plan.
- Type consistency: all persisted code uses `Material`, `Segment`, `AsrSettings`, `firstRoundStage`, `reviewStep`, and `nextReviewAt`; the ASR and subtitle paths both return the same validated `Segment[]` used by the repository and editor.
- No-placeholder scan: all test commands, interfaces, failure expectations, and recovery behavior are specified above.
