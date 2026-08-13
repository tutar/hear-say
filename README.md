# Hear & Say

English | [简体中文](README.zh-CN.md)

Turn the English you encounter online into material you can truly understand—and say out loud.

> **Early Preview** — Hear & Say is under active development and is currently installed as an unpacked Chrome extension.

[Try the latest release](https://github.com/tutar/hear-say/releases) · [How it works](#how-it-works) · [Contributing](CONTRIBUTING.md)

![Hear & Say learning dashboard](docs/images/learning-home.png)

## What is Hear & Say?

Hear & Say is a local-first Chrome extension for deliberate English listening and speaking practice. It turns audio from your browser—or an audio file you already have—into a guided loop of intensive listening, shadowing, blind listening, retelling, and review.

It also connects the words you meet while browsing to the same learning workspace: select a word or short phrase, request a contextual explanation, hear its American English pronunciation, and add it to your wordbook when it is worth keeping.

## Why build it?

English learners do not lack players, translation tools, or study methods. The problem is that these tools are disconnected: useful moments in a video are difficult to turn into practice material, while words encountered on the web rarely make it into a learning loop.

Hear & Say connects those steps without asking you to leave the browser:

```text
Browser content → learning material → listening and speaking practice → vocabulary → review
```

## How it works

1. Import a local audio file or deliberately record audio from the browser tab you choose.
2. Send the audio to your configured transcription service, then review the resulting sentence timeline.
3. Complete the first learning round: intensive listening → difficult-sentence shadowing → full-audio blind listening → paragraph retelling.
4. Return for scheduled reviews: difficult-sentence practice when you have saved difficult sentences → blind listening → retelling.
5. Use Free Listening whenever you want to leave the guided flow and control the whole recording or individual sentences yourself.

## Features

### Bring browser audio into your library

Record the sound from a tab you explicitly choose instead of relying on platform-specific download APIs. The flow has been verified with YouTube and Bilibili and is designed for audio playing in regular browser tabs. DRM-protected content and incognito tabs are not supported.

Pause and resume without splitting the material, keep listening while recording, remove unwanted ranges such as advertisements or mistakes, then import the retained audio as one material.

![Recording audio from a YouTube tab in the Hear & Say side panel](docs/images/tab-audio-recording.png)

![A completed browser recording waiting above the material library](docs/images/recording-draft-library.png)

### Practise through a complete listening-and-speaking loop

Work sentence by sentence with playback speed, repetition, translation, sentence analysis, and semantic-group overlays. Save a sentence when it is genuinely difficult; saved sentences feed later difficult-sentence practice instead of being selected automatically.

![Difficult-sentence practice with contextual analysis](docs/images/difficult-sentence-practice.png)

### Turn selections into useful vocabulary

Select up to eight English words on a regular web page or inside intensive listening. Hear & Say asks for a contextual explanation only when you choose **Translate**, and stores a card only when you choose **+ Vocabulary**.

![A contextual explanation for a selected phrase with an add-to-wordbook action](docs/images/selection-to-wordbook.png)

### Continue, review, or listen freely

- See first-round work and every generated review round in one place.
- Track blind listening, intensive listening, shadowing, retelling, and difficult-sentence practice by day and week.
- Inspect listening and speaking time separately for shadowing and retelling.
- Use Free Listening in sentence or list mode, with playback position saved per material and playback preferences shared across materials.

## Why a Chrome extension?

[Echo Loop](https://github.com/echo-loop/Echo-Loop) inspired the structured listening-and-speaking workflow in Hear & Say. Hear & Say explores a different product surface rather than acting as a browser port:

| Question | Echo Loop inspiration | Hear & Say focus |
| --- | --- | --- |
| Where does learning happen? | A dedicated learning experience | Inside the browser where learning and work already happen |
| How does material enter the loop? | Bring meaningful audio into structured practice | Add local audio or capture sound from a user-selected browser tab |
| What happens to words found online? | — | Explain deliberate text selections in context and add chosen items to a wordbook |

Hear & Say is an independent, unofficial project. It is not a fork, browser port, or official Echo Loop project, and it is not affiliated with or endorsed by Echo Loop.

## Try it

Hear & Say is currently distributed through GitHub Releases:

1. Download `hear-say-vX.Y.Z-chrome.zip` from the latest [GitHub Release](https://github.com/tutar/hear-say/releases). GitHub's automatic “Source code” archives are not loadable extension packages.
2. Extract the ZIP, open `chrome://extensions`, and enable **Developer mode**.
3. Choose **Load unpacked** and select the extracted directory.
4. On first open, configure transcription and vocabulary explanation in **AI Services**. You can leave the page, but features that still lack configuration remain disabled.

### Transcription setup

AssemblyAI is the default provider. Create an account in the [AssemblyAI dashboard](https://www.assemblyai.com/dashboard), copy its API key into **AI Services**, choose Universal-3.5 Pro or Universal-2, and keep English selected unless you explicitly want automatic language detection. Hear & Say uploads the audio, submits a transcript, and polls AssemblyAI until its timestamped result is ready.

To use another service, select **OpenAI compatible** and enter its Base URL, model, language, and optional API key. The endpoint must support `POST /audio/transcriptions` beneath that Base URL and return timestamped OpenAI `verbose_json`. For example, a local FunASR deployment might use Base URL `http://localhost:8021/v1` with a model such as `sensevoice`; the exact values and browser-access settings depend on that deployment.

Chrome asks for access only to the selected endpoint. If a request is blocked, confirm that the service allows requests from a Chrome extension and that its address and network access are correct. A failed transcription preserves the material and original audio so you can retry with the same provider or import SRT/VTT subtitles; Hear & Say never switches providers silently.

## Local-first by design

- Materials, recordings, sentence timelines, difficult-sentence marks, vocabulary, progress, and settings stay in the extension's local browser storage.
- Audio is sent only to the transcription endpoint you configure and authorize.
- A vocabulary request contains the selected text and its sentence—not the page URL, page title, audio name, or full page.
- API keys remain in extension-local storage and are not intentionally included in the interface, errors, or logs.
- Hear & Say does not operate a hosted backend.

Uninstalling the extension or clearing its browser data may permanently remove locally stored learning data. Back up anything you cannot afford to lose.

## Roadmap

### Available now

- Local audio import and user-initiated browser-tab recording
- A structured first learning round, generated review rounds, and Free Listening
- Contextual selection translation, Chrome TTS pronunciation, and a local wordbook
- Daily and weekly listening-and-speaking statistics

### Improving

- Recording stability, interruption recovery, and storage feedback
- Validation across more media websites
- Recording and material editing workflows
- Compatibility with more OpenAI-compatible transcription services

### Exploring

- Chrome Web Store distribution
- Cross-device synchronization
- Support for more browsers

“Exploring” describes directions under consideration, not committed features or release dates.

## Acknowledgements

Hear & Say was inspired by [Echo Loop](https://github.com/echo-loop/Echo-Loop) and its structured approach to intensive listening and speaking practice. Thank you to its creators and contributors for making that work open.

Hear & Say is built with open-source projects including [WXT](https://wxt.dev/), [React](https://react.dev/), and [Dexie.js](https://dexie.org/).

## Development

Development setup, architecture boundaries, testing, contribution rules, and the release process live in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Hear & Say is licensed under the [Apache License 2.0](LICENSE).
