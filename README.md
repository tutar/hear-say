# Hear & Say

English | [简体中文](README.zh-CN.md)

A local-first Chrome extension that turns real English audio into a complete listening and speaking loop: listen, inspect, shadow, and speak. Contextual vocabulary can be collected deliberately from web selections and intensive-listening sentences.

## Requirements

- Node.js 24 and the pnpm version declared by the project through Corepack
- Chrome 114 or later
- An OpenAI-compatible speech-to-text endpoint; the default is local FunASR at `http://localhost:8021/v1` using the `sensevoice` model
- Optional DeepSeek API access for contextual vocabulary explanations

## Develop and load the extension

```bash
corepack pnpm install
corepack pnpm dev
```

For a production build:

```bash
corepack pnpm build
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `.output/chrome-mv3`. The Hear & Say toolbar icon opens the learning experience in a regular browser tab.

## Install a released version

Download `hear-say-vX.Y.Z-chrome.zip` from the repository's [GitHub Releases](https://github.com/tutar/hear-say/releases), extract it, and load the extracted directory from `chrome://extensions` using **Load unpacked**.

Release source archives generated automatically by GitHub are source code, not ready-to-load extension packages.

## Configure AI services

Open **AI Services** from the avatar menu to configure transcription and vocabulary explanations. The default transcription settings are:

```text
Base URL: http://localhost:8021/v1
Model: sensevoice
```

Chrome asks for permission before audio is uploaded to a newly configured ASR host. If transcription fails, the material and original audio remain available for retrying or recovery by importing SRT/VTT subtitles.

Selecting up to eight English words on a regular web page or in intensive listening shows a Translate action. Only after that action is used are the selection and its sentence sent to the configured DeepSeek-compatible service. A vocabulary card is stored only after **+ Vocabulary** is selected.

## Data and credential boundaries

- Audio, sentence timelines, difficult-sentence marks, vocabulary, and progress remain in the extension's local IndexedDB.
- API keys remain in extension-local storage and are never printed in the UI, errors, or logs.
- Audio is sent only to the ASR endpoint explicitly configured and authorized by the user.
- The web content script reacts to deliberate selections; it does not scan pages or inspect editable fields.
- Vocabulary requests contain the selected text and its sentence, not the page URL, title, audio name, or full page.
- The `tts` permission is used only to pronounce a word or phrase the user explicitly plays.

## Verify

```bash
corepack pnpm test
corepack pnpm build
```

Unit and component tests live in `tests/`; Playwright extension tests live in `e2e/` and use local FunASR. See [CONTRIBUTING.md](CONTRIBUTING.md) for environment setup, test boundaries, contribution rules, and the release process.
