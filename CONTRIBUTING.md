# Contributing to Hear & Say

English | [简体中文](CONTRIBUTING.zh-CN.md)

Thank you for improving Hear & Say. This is a local-first Chrome extension; changes must not send audio, subtitles, API keys, or learning data to services the user did not explicitly configure.

## Development environment

- Node.js 24
- The project-declared pnpm version through Corepack
- Chrome or Playwright Chromium
- Local FunASR with CUDA only for full E2E tests

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

Enable Developer mode at `chrome://extensions`, then load `.output/chrome-mv3`.

## Test structure

```text
tests/unit/       Domain, database, and service unit tests
tests/component/  React components tested through user-visible behavior
tests/setup/      Shared Vitest environment
e2e/specs/        Playwright tests against the built Chrome extension
e2e/fixtures/     Publicly distributable, fixed test assets
```

Tests should cover public interfaces, user actions, and observable outcomes. Avoid assertions against internal component state, private functions, CSS class names, or incidental DOM structure.

```bash
corepack pnpm test
corepack pnpm test:watch
```

## Local FunASR and E2E

E2E uses a real OpenAI-compatible FunASR endpoint. Install and start it with:

```bash
pip install funasr fastapi uvicorn python-multipart
funasr-server --device cuda --port 8021
```

The OpenAPI document should then be available at `http://localhost:8021/openapi.json`. Install Playwright Chromium and run E2E:

```bash
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

Override the endpoint when needed:

```bash
ASR_BASE_URL=http://localhost:9000/v1 corepack pnpm test:e2e
```

The E2E profile is temporary and does not touch daily extension data. GitHub Actions does not run full E2E because hosted runners do not provide the CUDA FunASR environment. Vocabulary E2E intercepts DeepSeek requests at the Playwright network boundary and must never use a personal API key.

## Before opening a pull request

```bash
corepack pnpm test
corepack pnpm build
git diff --check
```

Use focused [Conventional Commits](https://www.conventionalcommits.org/) subjects such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, or `chore:`. Release notes are generated from these subjects, so write them in clear English.

A pull request should describe the user-visible change, verification commands and results, remaining risks, and screenshots or recordings for UI work. Never commit real API keys, personal learning data, unauthorized audio, `.output` artifacts, or Playwright reports.

## Release model

The version in `package.json` is the source of truth. A release tag must be exactly `v${version}`. Stable tags follow `vX.Y.Z`; prereleases follow forms such as `v0.2.0-beta.1`.

Pushing a `v*` tag starts the Release workflow. It verifies the tag and version, confirms the commit belongs to `main`, installs frozen dependencies, runs tests, builds a WXT Chrome ZIP, generates English notes from Conventional Commits with git-cliff, and publishes the GitHub Release. Stable releases become Latest; suffixed versions become Pre-releases. Any failed step prevents publication.

The release contains `hear-say-vX.Y.Z-chrome.zip`. GitHub's automatic source archives remain separate. Release notes are stored only on the GitHub Release; the repository does not maintain `CHANGELOG.md`.

### First release

The repository starts at `0.1.0`. After the release automation has landed on and passed CI for `main`, create the first annotated tag without changing the package version:

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

### Later releases

The local release helper accepts `patch`, `minor`, `major`, or an explicit prerelease version. It requires a clean `main` exactly matching `origin/main`, then tests, builds, updates the package version, creates the version commit, and creates an annotated tag. It deliberately does not push.

```bash
pnpm release patch
# or: pnpm release minor
# or: pnpm release 0.2.0-beta.1
```

Review the resulting commit and tag, then explicitly publish both:

```bash
git push origin main
git push origin v0.1.1
```

Use `git`, not `gh`, to push tags. The GitHub Actions workflow uses `gh` with its scoped `GITHUB_TOKEN` to create the Release.

### Failure recovery

For a transient failure, rerun the failed jobs in GitHub Actions. For a workflow defect, fix the workflow on `main`, run the Release workflow manually, and supply the original tag. Manual recovery still checks out, validates, tests, and packages that immutable tag—not `main`.

Never move, overwrite, delete, or force-push a published release tag. If the tagged product code is faulty, fix it and issue a new patch version.
