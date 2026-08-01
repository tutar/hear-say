# Tab audio recording spike results

Status: conditional pass — Phase 2 development may begin; listed manual checks still gate experimental release.

This document records Phase 1 evidence for the technical gate in [tab-audio-recording-design.md](./tab-audio-recording-design.md). The conditional pass authorizes Phase 2 development but does not classify the feature as supported; every pending row remains release work.

## Environment

| Item | Result |
| --- | --- |
| Operating system | Pending manual run |
| Chrome version | Pending manual run; minimum supported version is 116 |
| Extension build | `corepack pnpm build` passes |
| Automated tests | 46 files and 141 tests pass on 2026-08-01 |
| Output format | PCM WAV, mono, 16 kHz, 16-bit little-endian |
| Chunk target | 80,000 samples, approximately 5 seconds |

## Automated evidence

- Recording Session transitions keep pause and resume in one session and exclude paused time from captured duration.
- The WAV encoder produces independently asserted RIFF, WAVE, format, sample-rate, bit-depth, data-length, and sample fields.
- IndexedDB chunks survive a repository instance change and reconstruct in sequence.
- A programmatic excluded middle interval reconstructs one continuous WAV.
- The page context menu opens the internal Side Panel for the tab where the learner invoked “使用 Hear & Say 录制当前标签页”.
- The internal Side Panel exposes enable, start, pause, continue, complete, cancel, elapsed time, chunk count, buffered samples, persisted bytes, and error output.
- Production build contains `sidepanel.html`, `offscreen.html`, the `side_panel` manifest entry, required Offscreen permission, and optional `tabCapture` permission.

## Manual run procedure

1. Run `corepack pnpm build` and load `.output/chrome-mv3` as an unpacked extension.
2. Open a source page, right-click, choose “使用 Hear & Say 录制当前标签页”, and enable tab recording in the opened Side Panel.
3. On each source type below, start playback, record speech, pause across a known middle section, continue, and complete.
4. Save the generated WAV. Confirm that it stays audible during capture, plays at the correct pitch and rate, and omits the paused section without creating multiple files.
5. Record Chrome Task Manager memory at the start and end of the 10-, 30-, and 60-minute runs. Confirm persisted bytes grow while the in-memory sample buffer repeatedly returns below 80,000 samples.
6. During separate runs, close the Side Panel, close the source tab, and terminate the Offscreen Document. Record how many persisted chunks remain and whether the recovered WAV plays.
7. Submit the WAV to the configured local FunASR service and record whether English sentence timestamps are present, ordered, and inside the WAV duration.

## Compatibility evidence

| Source type | Capture | Audible monitor | Pause continuity | WAV playback | Notes |
| --- | --- | --- | --- | --- | --- |
| Ordinary HTML5 audio | Pending | Pending | Pending | Pending | Use a local or rights-cleared fixture |
| YouTube, ordinary video | Pass | Pass | Pass | Pass | Manually verified on 2026-08-01; pause content is excluded and resume remains one WAV. Source playback speed is preserved in the recording. |
| Bilibili, ordinary video | Pending | Pending | Pending | Pending | Record type only; do not retain browsing history here |

## Stability and recovery

| Scenario | Expected | Result |
| --- | --- | --- |
| Close Side Panel | Offscreen capture continues | Pending |
| Close source tab | Persisted portion is retained | Pending |
| Terminate Offscreen Document | Persisted chunks remain recoverable | Pending |
| Browser interruption | Persisted chunks remain recoverable | Pending |
| 10-minute run | Correct WAV; bounded capture buffer | Pending |
| 30-minute run | Correct WAV; bounded capture buffer | Pending |
| 60-minute run | Correct WAV; bounded capture buffer | Pending |

## FunASR

Local reference command:

```bash
funasr-server --device cuda --port 8021
```

| Check | Result |
| --- | --- |
| Generated WAV accepted | Pass — FunASR Server 1.3.30 on CUDA |
| English text returned | Pass structurally; English-only content should send `language=en` to avoid SenseVoice multilingual auto-detection errors |
| Sentence timestamps ordered | Pass |
| Timestamps within WAV duration | Pass |
| Middle exclusion produces a continuous timeline | Pass — paused content is absent and resumed capture remains one file |

The OpenAI-compatible endpoint advertises an optional `language` field. Hear & Say defaults this field to `en`; learners may explicitly select automatic detection, in which case the field is omitted. A repository English fixture produced identical English text and timestamps with automatic detection and forced English. A real Friends recording exposed mixed-language output under automatic detection, which is why English is the product default.

## Recommendation

**Conditional pass.** The real YouTube capture loop, audible monitoring, pause continuity, WAV generation, and local FunASR timestamps pass. Product development proceeds while HTML5/Bilibili compatibility, lifecycle recovery, and 10/30/60-minute stability remain tracked Phase 2 validation items. These pending checks block experimental release, not Phase 2 implementation.
