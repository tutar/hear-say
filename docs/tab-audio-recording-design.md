# Current-tab audio recording design

Status: confirmed design; implementation gated by a technical spike.

## Goal

Let a learner deliberately capture useful English sound from the browser tab they are already watching, remove advertisements or mistakes, and import the result through the same material and transcription lifecycle as a local audio file.

This is a generic **record current tab audio** capability. It is not presented as a YouTube or Bilibili downloader, does not resolve media URLs, does not download playlists, and does not monitor tabs in the background.

## Product surfaces

The existing three-surface model remains authoritative:

- The webpage overlay handles selected-text vocabulary and an optional recording launcher.
- The Side Panel owns recording permission, source confirmation, controls, status, and the transition to editing.
- The full Hear & Say page owns draft editing, material import, transcription, storage management, and learning.

No extension Popup is introduced.

### Entry points

Three entry points open the recording Side Panel without immediately starting capture:

1. Page context menu: “使用 Hear & Say 录制当前标签页”.
2. Keyboard command: `Alt+Shift+R` on Windows/Linux and `Option+Shift+R` on macOS. If Chrome cannot assign it, settings show that it is unassigned and link to `chrome://extensions/shortcuts`.
3. A collapsed ear launcher at the right edge of configured websites.

The default launcher allowlist contains YouTube and Bilibili. Each site uses an optional host permission granted separately on demand. Users can disable either default site, add the current site or another domain, remove a custom site, and temporarily hide the launcher. Refusing site access disables only injection; context-menu, shortcut, and recording capabilities remain available. Douyin is not initially granted by default and can be added or used through the other entry points.

## Permissions and consent

- `tabCapture` is optional and requested only after the learner chooses “启用标签页录制”. Permission and recording are two separate actions.
- Site injection uses per-origin optional host permissions, never an all-sites grant.
- The first recording enablement requires one versioned acknowledgement that only content the learner has the right to use should be recorded. Later sessions retain a short reminder without another checkbox.
- `unlimitedStorage` is optional and is not requested at installation or first recording.
- Incognito recording is unsupported in the first version.

The README and contributor documentation must describe this as deliberate tab-audio capture for authorized personal learning, not platform downloading.

## Recording lifecycle

Only one Recording Session may be active across the browser.

```text
idle
  → recording
  ↔ paused
  → completed draft
  → editing or deferred
  → imported material

recording or paused
  → cancelled
  → interrupted draft
```

- The source tab is frozen when recording begins. Switching tabs never changes the source.
- Attempting to start another source requires completing or cancelling the active session.
- Pause and resume are recording controls only; they never control the website player and never create separate materials.
- The source page continues playing audibly while captured audio is routed through the recorder.
- Website pause, seek, playback rate, buffering, navigation, advertisements, and notifications affect the captured result exactly as heard unless the learner pauses recording or excludes them later.
- Continuous silence produces a warning but never automatically pauses capture.
- Closing the source tab stops capture and retains successfully persisted audio as an interrupted draft.
- Navigation in the same source tab keeps capture active and displays a source-change warning.
- Thirty minutes produces a recommendation to finish; sixty minutes automatically stops and retains the recording. Paused time does not count toward these limits.

During every active session, the source page shows a recording indicator with state and elapsed captured time. It may collapse to a red dot but cannot be completely hidden, including in fullscreen. Clicking it reopens the Side Panel. Completion, cancellation, or interruption removes it. System notifications report the 30-minute warning, automatic stop, storage failure, and source-tab closure.

## Side Panel

Before recording, the Side Panel displays the current tab title and site, permission state, storage readiness, the content-rights reminder, and a start action.

While active it displays:

- fixed source title and site;
- recording, paused, or interrupted state;
- captured duration and excluded paused duration;
- estimated draft size;
- pause/continue, complete, and cancel actions;
- warnings for silence, source navigation, duration, or storage.

Completing capture does not steal focus from the source page. The panel offers:

- “编辑并导入”, which opens the full-page draft editor;
- “稍后处理”, which releases the active-session slot and retains a Recording Draft;
- deletion with confirmation.

## Draft editing and advertisements

The first version does not automatically identify advertisements. Website DOM adapters are too fragile, server-inserted advertisements are indistinguishable from content, and creator sponsorships are semantically ambiguous.

Learners remove unwanted sound in two ways:

1. Pause recording during an advertisement and continue within the same Recording Session.
2. Add multiple non-destructive Excluded Intervals in the full-page draft editor.

The editor provides audio preview, a time ruler, current position, included/excluded ranges, set-start/set-end actions, exclude, undo, material naming, and source removal. It does not require a waveform in the first version. Import concatenates all retained intervals in order into one continuous audio asset; transcription runs only against that final timeline, so removed intervals leave no subtitle gaps.

## Recording Drafts

Recording Drafts appear in a separate section above formal materials and display source, captured time, duration, size, and state. They never enter structured learning or statistics.

- Drafts are never automatically deleted.
- Seven days adds a pending reminder; thirty days strengthens it without deleting data.
- Cancellation explicitly deletes temporary chunks after confirmation.
- Successful material creation and durable final-audio storage delete the source draft and temporary chunks.
- Failed merging keeps the draft and does not create a partial Material.
- The same Source Reference may produce any number of Materials; URLs are never deduplicated.

Default names use the page title. Duplicate names receive a sequence suffix unless the learner supplies another name.

## Source and privacy

A confirmed Recording Draft may retain page title, URL, site, favicon, recording time, and retained duration locally. This is a Source Reference, not browsing history.

- No YouTube Data API is required.
- Source metadata is never sent to ASR.
- ASR receives only the learner-confirmed final audio.
- The draft editor can remove its Source Reference before import.
- Exports include site and title by default; including the full URL requires an explicit export choice.

## Storage and recovery

An Offscreen Document owns the MediaStream and recorder so closing the Side Panel or full page does not stop capture. Approximately every five seconds it persists an independently recoverable audio chunk in extension-owned IndexedDB. UI state is projected from the durable Recording Session rather than owning it.

After an extension or browser interruption, the next launch offers the already persisted part as an interrupted Recording Draft. It never attempts to resume capture from the former tab. Normal cancellation removes temporary chunks; abnormal and storage-related stops preserve every successfully written chunk.

Storage uses the normal dynamic IndexedDB quota first. `navigator.storage.estimate()` supplies approximate usage and quota:

- below 80%, no expansion prompt is shown;
- at or above 80%, settings offer the optional `unlimitedStorage` permission after an explicit click;
- refusal is remembered and does not cause repeated prompts;
- without expansion, less than 250 MB estimated remaining capacity blocks a new recording, reserving approximately 150 MB for a maximum session and 100 MB for processing;
- every write handles `QuotaExceededError`; failure stops capture and retains earlier chunks.

The “录制与存储” settings page shows formal-material, draft, and temporary usage separately; site grants, capture and storage permissions, fixed duration limits, and the keyboard-command state also live there. No user audio is automatically removed.

## Audio direction

Tab Recording is speech-learning media, not an archival copy of a video soundtrack. The intended output is mono, speech-oriented, and compact while preserving intelligible consonants, linking, reduction, stress, and intonation.

The technical spike starts with 16 kHz, 16-bit mono WAV and compares 24 kHz only if real listening quality is inadequate. WAV is preferred first because the existing import and local FunASR path already accept it, and PCM boundaries simplify pause, recovery, exclusions, and deterministic concatenation. If long-duration memory, disk, or playback quality fails the gate, the spike must evaluate a compressed chunk format before full product development.

## Material import and transcription

Import is atomic from the learner's perspective:

1. Validate and combine retained draft intervals.
2. Durably create the final audio asset and Material in “等待转写”.
3. Remove draft and temporary data only after successful persistence.
4. Automatically run the currently configured ASR.

The learner may leave while transcription runs. The Side Panel, library, and material page expose the same task state. Failure preserves the final audio and supports retry, changed ASR settings, or SRT/VTT import, exactly like local-file import.

## Delivery phases

The work is deliberately split into two phases. Phase 1 answers whether the capture architecture is viable; Phase 2 turns the validated path into a supported product capability. Phase 2 must not begin merely because Phase 1 code exists—the validation report and gate below must be reviewed first.

### Phase 1 — capture and WAV technical validation

Phase 1 delivers the smallest real Chrome extension path needed to test the risky assumptions:

- the minimum manifest permissions and Offscreen Document required for `tabCapture`;
- a page context-menu entry, “使用 Hear & Say 录制当前标签页”, which opens the internal Side Panel for the invoking source tab and provides the user gesture required by the real-Chrome validation path;
- a deliberately plain, internal Side Panel harness with source identity, enable permission, start, pause, continue, stop, cancel, elapsed time, chunk count, memory diagnostics, and error output;
- one global active Recording Session bound to the original source tab;
- audible monitoring that returns captured sound to the learner;
- speech-oriented mono PCM capture with a 16 kHz, 16-bit WAV result, plus a 24 kHz comparison only when listening quality requires it;
- approximately five-second IndexedDB chunk persistence without retaining the complete recording in memory;
- reconstruction of one playable WAV from persisted chunks;
- pause/resume within one output and a programmatic middle-interval exclusion proving continuous reconstruction;
- recovery of persisted chunks after forced Side Panel, Offscreen Document, source-tab, and browser interruption scenarios;
- direct submission of the generated WAV to the configured local FunASR service and verification of sentence timestamps;
- manual compatibility runs for one normal YouTube video, one normal Bilibili video, and one ordinary HTML5 audio page;
- 10-, 30-, and 60-minute stability runs.

Phase 1 explicitly does **not** deliver the public webpage launcher, final keyboard experience, polished Side Panel, draft library, visual interval editor, production notifications, settings page, optional storage expansion, or general release UX. The context-menu entry is included only because it is the smallest stable user-gesture path that closes the real-Chrome capture validation loop. Temporary diagnostic UI must not be mistaken for the final interaction design.

Phase 1 produces `docs/tab-audio-recording-spike-results.md` containing the Chrome version, operating system, test sources by type rather than browsing history, WAV parameters and sizes, memory observations, recovery outcomes, FunASR results, failures, and a clear `pass`, `revise`, or `stop` recommendation. A `pass` requires every blocking criterion in the Technical validation gate. `Revise` keeps work in Phase 1; `stop` records why the feature will not proceed.

### Phase 2 — product recording workflow

Phase 2 begins after a reviewed Phase 1 pass or conditional pass. A conditional pass moves explicitly recorded manual checks into Phase 2 without treating them as completed. It delivers the complete confirmed workflow:

Implementation started on 2026-08-01. The first vertical slices persist completed and interrupted captures as Recording Drafts, list them above formal materials, provide a refresh-safe draft route and WAV preview, and import a learner-named draft through the existing Material transcription lifecycle before cleaning up its temporary data. The draft editor also persists multiple non-destructive Excluded Intervals, merges overlaps, visualizes them on the audio rail, and rebuilds both preview and imported WAV from the retained intervals. The Side Panel completed state now exposes the product actions “编辑并导入” and “稍后处理”; it opens or focuses the draft route through the shared app-tab boundary and no longer exposes spike-only WAV download or direct FunASR controls.

The first recording enablement now requires the versioned content-rights acknowledgement before the separate `tabCapture` permission action. The acknowledgement is retained locally, does not request permission by itself, and becomes a short reminder on later sessions.

Before starting capture, the Side Panel now reads the browser storage estimate. Less than 250 MB estimated remaining space blocks a new session; usage at or above 80% produces a warning without blocking when the reserve remains sufficient. An unavailable estimate fails open rather than preventing recording.

Captured duration is now derived from samples accepted by the Offscreen recorder, so paused time does not count. At 30 captured minutes the recorder emits a persisted warning and a system notification. At exactly 60 captured minutes it stops accepting samples, completes the WAV, asks the background worker to retain the Recording Draft, clears the active slot, and emits an automatic-completion notification. Reopening the Side Panel restores the completed draft action even when the panel was closed at the limit.

- production Recording Session, Recording Draft, persisted chunk, Excluded Interval, and Source Reference models and repositories;
- production hardening of the context-menu entry, plus keyboard and allowlisted webpage-ear entry points;
- default YouTube and Bilibili launcher configuration with per-site optional authorization and custom domains;
- first-use content-rights acknowledgement and on-demand `tabCapture` authorization;
- the designed Side Panel recording, paused, completed, interrupted, permission, silence, navigation, storage, and failure states;
- a persistent source-page recording indicator and the agreed duration/storage/system notifications;
- 30-minute warning, 60-minute stop, one-active-session enforcement, source-tab lifecycle handling, and incognito rejection;
- deferred and interrupted Recording Drafts in a separate library section with age and storage reminders;
- the full-page draft editor with preview, multiple non-destructive Excluded Intervals, undo, naming, and optional Source Reference removal;
- atomic final-audio creation, automatic transcription, retry, subtitle import, and draft cleanup integrated with the existing Material lifecycle;
- duplicate-source handling without URL deduplication;
- the “录制与存储” settings page, storage breakdown, 80% optional-expansion prompt, 250 MB start guard, site grants, capture permission, and shortcut status;
- privacy, README, contributor, accessibility, responsive, unit, component, integration, and real-Chrome E2E coverage;
- a visible experimental label and at least one week of real-use validation before removing it.

Phase 2 is complete only when every confirmed user-facing rule in this document is implemented, the existing local-file import and learning flows remain green, and unfinished or interrupted recordings cannot silently disappear.

## Technical validation gate

Full UI implementation begins only after a minimal real-Chrome spike passes all essential checks.

### Compatibility

- A normal YouTube video, normal Bilibili video, and non-video HTML5 audio page produce valid audio.
- DRM, member-protected media, incognito, and every possible video are explicitly outside the guarantee.

### Audio and capture

- One playable mono WAV is produced without obvious clipping, duplication, pitch shift, or rate errors.
- Captured sound remains audible to the learner.
- Pause excludes content and resume continues the same draft.
- Sixty minutes completes without losing content.
- Closing the Side Panel does not stop capture.
- Recorder memory does not grow linearly with duration because chunks are persisted.

### Recovery and transcription

- Five-second persistence survives forced recorder-context interruption.
- Closing the source retains the persisted portion.
- The current FunASR accepts the generated WAV and returns valid English sentence-level timestamps.
- Excluding a middle interval produces a continuous final audio and a newly continuous transcription timeline.

Audible monitoring and FunASR transcription must pass before Phase 2 begins. By product decision, long-duration stability, cross-source compatibility, and forced-interruption recovery may continue as tracked Phase 2 validation work, but they must pass before the experimental feature is released. After the gate passes, the complete feature is released visibly as experimental and remains so through at least one week of real use.
