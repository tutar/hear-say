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

**Learning Session**:
A resumable, time-bounded learning activity for one material, used consistently for both the First Round and a Review. Its effective duration accumulates while the learning place is visible, regardless of audio playback, pauses while hidden, and ends when the learner explicitly leaves the learning place. Only one Learning Session may be active at a time; an ended session is immutable and is deleted only with its material.
_Avoid_: Practice Session, study page

**Listening Time**:
Effective Learning Session time spent on input through blind listening or intensive listening. It is mutually exclusive with Speaking Time.
_Avoid_: Audio playback duration, total session time

**Speaking Time**:
Effective Learning Session time spent on output through shadowing or retelling. Shadowing counts only as Speaking Time so total learning time is never double-counted.
_Avoid_: Microphone recording duration, total session time

**Learning Day**:
A local calendar day used to group Listening Time and Speaking Time. Time crossing local midnight is split between Learning Days.
_Avoid_: UTC day, rolling 24 hours

**Learning Week**:
The seven local Learning Days from Monday through Sunday used for weekly totals.
_Avoid_: Rolling seven days, Sunday-start week

**First Round**:
The one-time progression through listening, intensive listening, shadowing, and retelling for a ready material. It may span multiple Learning Sessions until completed.
_Avoid_: Practice, initial Review

**Intensive Listening Repetition**:
A complete playback from the current sentence's start to its end during intensive listening. Each sentence requires three repetitions by default or an explicit skip; progress belongs to the current First Round or Review across Learning Sessions, while partial playback and seeking do not count.
_Avoid_: Play-button click, audio loop count

**Retelling Keywords**:
The learner-authored keyword notes saved independently for one First Round or one Review. A later Review never overwrites an earlier set.
_Avoid_: Material keywords, shared retelling draft

**Review**:
A repeated progression through the same listening, intensive listening, shadowing, and retelling stages as the First Round, attempted through one or more Learning Sessions and governed by its Review Schedule. Its schedule advances only after retelling is completed; difficult-sentence bookmarks are not automatic Review steps.
_Avoid_: Practice mode, replay, Review Session type

**Review Plan**:
A versioned, configurable sequence of positive, non-decreasing review intervals measured from each preceding completion. Its length determines the Review count; editing the global plan creates a new version and never rewrites completed Review history.
_Avoid_: Hard-coded intervals, Review Session list

**Review Schedule**:
A material's current position in one pinned Review Plan version and the time its next Review becomes due. Existing schedules do not silently migrate when the global plan changes.
_Avoid_: Review Plan, session history
