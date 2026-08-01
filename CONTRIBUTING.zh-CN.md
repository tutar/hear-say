# 为 Hear & Say 做贡献

[English](CONTRIBUTING.md) | 简体中文

感谢你帮助改进 Hear & Say。项目是本地优先的 Chrome 扩展；任何改动都不得把音频、字幕、API Key 或学习数据发送到用户未明确配置的服务。

## 开发环境

- Node.js 24
- 通过 Corepack 使用项目声明的 pnpm 版本
- Chrome 或 Playwright Chromium
- 只有完整 E2E 需要本地 FunASR 与 CUDA

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

在 `chrome://extensions` 中启用开发者模式，然后加载 `.output/chrome-mv3`。

## 测试结构

```text
tests/unit/       领域、数据库和服务的单元测试
tests/component/  从用户可见行为验证 React 组件
tests/setup/      Vitest 公共测试环境
e2e/specs/        针对构建后 Chrome 扩展的 Playwright 测试
e2e/fixtures/     可公开分发的固定测试素材
```

测试应验证公开接口、用户操作和可观察结果。不要断言组件内部 state、私有函数、CSS 类名或无业务意义的 DOM 层级。

```bash
corepack pnpm test
corepack pnpm test:watch
```

## 本地 FunASR 与 E2E

E2E 使用真实的 OpenAI 兼容 FunASR 接口。安装并启动：

```bash
pip install funasr fastapi uvicorn python-multipart
funasr-server --device cuda --port 8021
```

启动后应能访问 `http://localhost:8021/openapi.json`。安装 Playwright Chromium 并运行 E2E：

```bash
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

需要时可以覆盖服务地址：

```bash
ASR_BASE_URL=http://localhost:9000/v1 corepack pnpm test:e2e
```

E2E 使用临时浏览器 Profile，不会接触日常扩展数据。GitHub Actions 不运行完整 E2E，因为托管 Runner 没有 CUDA FunASR 环境。词汇 E2E 会在 Playwright 网络边界拦截 DeepSeek 请求，禁止使用个人 API Key。

## 提交 Pull Request 前

```bash
corepack pnpm test
corepack pnpm build
git diff --check
```

提交标题使用聚焦的 [Conventional Commits](https://www.conventionalcommits.org/) 格式，例如 `feat:`、`fix:`、`docs:`、`test:`、`refactor:` 或 `chore:`。Release Notes 会根据这些标题生成，因此标题应使用清晰的英文。

PR 应说明用户可见变化、验证命令和结果、遗留风险，以及 UI 改动的截图或录屏。禁止提交真实 API Key、个人学习数据、未授权音频、`.output` 构建产物或 Playwright 报告。

## 发布模型

`package.json` 中的版本是唯一事实来源，release tag 必须严格等于 `v${version}`。正式版本使用 `vX.Y.Z`，预发布版本使用 `v0.2.0-beta.1` 等形式。

推送 `v*` tag 会触发 Release 工作流。工作流会校验 tag 与版本、确认提交属于 `main`、冻结安装依赖、运行测试、构建 WXT Chrome ZIP、通过 git-cliff 从 Conventional Commits 生成英文说明，最后创建 GitHub Release。正式版本标记为 Latest，带后缀的版本标记为 Pre-release；任何步骤失败都不会创建 Release。

Release 只附加 `hear-say-vX.Y.Z-chrome.zip`。GitHub 自动生成的源码包保持独立。发布说明仅保存在 GitHub Release 中，仓库不维护 `CHANGELOG.md`。

### 首次发布

项目初始版本已经是 `0.1.0`。发布自动化合入 `main` 且 CI 通过后，不修改 package 版本，直接创建首个 annotated tag：

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

### 后续发布

本地发布脚本接受 `patch`、`minor`、`major` 或明确的预发布版本。它要求工作区干净、当前处于 `main` 且与 `origin/main` 完全一致，随后运行测试和构建、更新 package 版本、创建版本提交和 annotated tag。脚本不会自动推送。

```bash
pnpm release patch
# 或：pnpm release minor
# 或：pnpm release 0.2.0-beta.1
```

检查生成的提交和 tag，然后明确推送二者：

```bash
git push origin main
git push origin v0.1.1
```

推送 tag 使用 `git`，不是 `gh`。GitHub Actions 工作流会使用权限受限的 `GITHUB_TOKEN` 和 `gh` 创建 Release。

### 失败恢复

临时故障可以在 GitHub Actions 中重新运行失败任务。若工作流本身有缺陷，先在 `main` 修复，再手动运行 Release 工作流并输入原 tag。恢复流程仍会检出、校验、测试并打包不可变的原 tag，而不是 `main`。

不得移动、覆盖、删除或强推已经发布的 tag。如果 tag 对应的产品代码有问题，应修复后发布新的 patch 版本。
