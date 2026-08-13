# Hear & Say

Hear & Say turns real English audio into a local-first listening and speaking practice experience.

## Language

**Learning Workspace**:
The learner's current place across learning, materials, vocabulary, and settings. It maps browser navigation to that place and coordinates user intent without owning transcription, practice, vocabulary, or browser-specific rules.
_Avoid_: App state, router, application service

**Workspace Place**:
The single location currently occupied in the Learning Workspace, such as the library, a material, a practice, or a word. Transient visual state is not a Workspace Place.
_Avoid_: Page flags, active view, route state

**Workspace History**:
The browser-owned session history of Workspace Place URLs. It stores place identities in URLs, never copies of materials, words, or other learning data.
_Avoid_: Data snapshots, custom history stack

**Sentence Edit**:
An exclusive draft for one sentence in a material. Another sentence cannot be edited until the current Sentence Edit is saved or discarded.
_Avoid_: Bulk subtitle draft, multi-row edit

**Transcription Task**:
An in-progress attempt to turn one material's audio into timed sentences. It continues across Workspace Place changes, remains visible when revisited, and cannot run concurrently twice for the same material.
_Avoid_: Page loading, import spinner

**Tab Recording**:
User-initiated capture of the sound currently produced by one browser tab for personal learning. It is source-agnostic and is neither a video download nor background monitoring.
_Avoid_: YouTube import, video download, audio extraction

**Recording Session**:
The single active attempt to create one Tab Recording from one fixed source tab. Pausing excludes sound without ending or splitting the session; completing or interrupting it produces one Recording Draft.
_Avoid_: Recording chunk, material, capture tab

**Recording Draft**:
A completed or interrupted Tab Recording retained locally until the learner edits, imports, or deletes it. It is not a learning Material and is never transcribed before import confirmation.
_Avoid_: Pending material, failed transcription, temporary file

**Excluded Interval**:
A non-destructive time range omitted from a Recording Draft's final audio, commonly an advertisement or accidental capture. Multiple Excluded Intervals still produce one continuous imported Material.
_Avoid_: Deleted recording, separate clip, silence

**Source Reference**:
Local metadata identifying the page from which a Tab Recording originated, including its title, URL, site, and recording time. It belongs only to a learner-confirmed recording and is never sent to transcription services.
_Avoid_: Browsing history, ASR metadata

**Learning Session**:
A resumable, time-bounded learning activity for one material, used consistently for both the First Round and a Review. Its effective duration accumulates while the learning place is visible, regardless of audio playback, pauses while hidden, and ends when the learner explicitly leaves the learning place. Only one Learning Session may be active at a time; an ended session is immutable and is deleted only with its material.
_Avoid_: Practice Session, study page

**Listening Time**:
Effective Learning Session time spent while audio is playing, plus all Blind Listening and Intensive Listening activity. It is mutually exclusive with Speaking Time.
_Avoid_: Audio playback duration, total session time

**Speaking Time**:
Effective visible time in Difficult Sentence Shadowing, Retelling, or Difficult Sentence Reinforcement while audio is paused. It is mutually exclusive with Listening Time so total learning time is never double-counted.
_Avoid_: Microphone recording duration, total session time

**Learning Day**:
A local calendar day used to group Listening Time and Speaking Time. Time crossing local midnight is split between Learning Days.
_Avoid_: UTC day, rolling 24 hours

**Learning Week**:
The seven local Learning Days from Monday through Sunday used for weekly totals.
_Avoid_: Rolling seven days, Sunday-start week

**First Round**:
The one-time progression through Blind Listening, Intensive Listening, Difficult Sentence Shadowing, and Retelling for a ready material. Its difficult-sentence list freezes when Difficult Sentence Shadowing begins, and it may span multiple Learning Sessions until completed.
_Avoid_: Practice, initial Review

**Intensive Listening Pause**:
The four-second pause after one sentence reaches its end during Intensive Listening. It may be paused and resumed; when it finishes, the sentence completes and the next sentence starts automatically. Skipping moves on without completing the sentence, and an unfinished pause is not persisted.

**Practice Segment**:
The timestamped unit used for sentence-level listening practice. For new AssemblyAI transcriptions, sentence results are combined only within an AssemblyAI paragraph boundary, targeting 5–12 seconds and at most 20 words. A single long source sentence remains intact, while existing materials are never regrouped automatically.
_Avoid_: Repetition count, recording countdown, play-button click

**Retelling Keywords**:
The learner-authored keyword notes saved independently for one First Round or one Review. A later Review never overwrites an earlier set.
_Avoid_: Material keywords, shared retelling draft

**Review**:
A scheduled learning progression through Blind Listening, optional Difficult Sentence Reinforcement, and Retelling. A Review freezes its stages and difficult-sentence list when first started, may span multiple Learning Sessions, and advances its Review Schedule only after Retelling is completed.
_Avoid_: Practice mode, replay, Review Session type

**Review Occurrence**:
One numbered Review within a Review Schedule. Before it starts it exposes its interval rule; when first started it freezes its stage list and difficult-sentence list, and after completion it records the actual completion time.
_Avoid_: Review Session, schedule step

**Review Plan**:
A versioned, configurable sequence of positive, non-decreasing review intervals measured from each preceding completion. Its length determines the Review count; editing the global plan creates a new version and never rewrites completed Review history.
_Avoid_: Hard-coded intervals, Review Session list

**Review Schedule**:
A material's ordered Review Occurrences under one pinned Review Plan version, including the exact current due time and relative interval rules for later occurrences. Existing schedules do not silently migrate when the global plan changes.
_Avoid_: Review Plan, session history

**Difficult Sentence Shadowing**:
The First Round stage that practises the difficult sentences frozen when the stage begins. Each sentence is explicitly completed or skipped, without a forced repetition count.
_Avoid_: Shadowing all sentences, Review reinforcement

**Difficult Sentence Reinforcement**:
An optional Review stage included only when difficult sentences exist as that Review Occurrence starts. Its frozen sentences are explicitly completed or skipped, without a forced repetition count.
_Avoid_: Difficult bookmark list, Intensive Listening

**Free Listening**:
Self-directed whole-material listening outside the First Round and Reviews. It continuously plays across sentence boundaries, supports whole-material and sentence looping plus single-sentence and sentence-list views, never advances structured progress, and contributes to Intensive Listening Time.
_Avoid_: Review, free practice, audio preview

**Training Time**:
Effective Learning Session time classified exactly once as Blind Listening, Intensive Listening, Difficult Sentence Shadowing, Retelling, or Difficult Sentence Reinforcement. Free Listening contributes to Intensive Listening; mixed listening-and-speaking stages subdivide their time by audio playback state.
_Avoid_: Audio duration, duplicated input/output time
