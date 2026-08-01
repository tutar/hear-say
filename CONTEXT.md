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

**Practice**:
The learner's first progression through the listening, intensive listening, shadowing, and retelling stages of one ready material.
_Avoid_: Review session

**Review**:
A due repetition of a completed material that advances its review schedule when finished.
_Avoid_: Practice mode, replay
