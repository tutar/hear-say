# 为 Hear & Say 做贡献

感谢你帮助改进 Hear & Say。项目是本地优先的 Chrome 扩展；请确保改动不把音频、字幕、API Key 或学习数据发送到用户未明确配置的服务。

## 开发环境

- Node.js 24
- 通过 Corepack 使用项目声明的 pnpm 版本
- Chrome 或 Playwright Chromium
- 仅运行 E2E 时需要本地 FunASR 与 CUDA 环境

安装依赖并启动开发构建：

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

在 Chrome 的 `chrome://extensions` 中启用开发者模式，然后加载 `.output/chrome-mv3`。

## 测试结构

```text
tests/unit/       领域、数据库和服务的单元测试
tests/component/  从用户视角验证 React 组件
tests/setup/      Vitest 的公共测试环境
e2e/specs/        构建后 Chrome 扩展的 Playwright 测试
e2e/fixtures/     可公开分发的固定测试素材
```

测试应验证公开接口、用户操作和可观察结果。不要断言组件内部 state、私有函数、CSS 类名或无业务意义的 DOM 层级。新增源码测试时按测试类型放入上述目录，不要在 `src` 中重新创建 `__tests__`。

运行单元和组件测试：

```bash
corepack pnpm test
```

监听模式：

```bash
corepack pnpm test:watch
```

## 本地 FunASR 与 E2E

E2E 使用真实的 OpenAI 兼容 FunASR 接口，不会模拟转写响应。安装依赖：

```bash
pip install funasr fastapi uvicorn python-multipart
```

使用 CUDA 在默认端口启动服务：

```bash
funasr-server --device cuda --port 8021
```

启动后应能访问 `http://localhost:8021/openapi.json`，扩展使用的默认 Base URL 是 `http://localhost:8021/v1`。FunASR 的安装和服务参数请参考 [FunASR 官方文档](https://modelscope.github.io/FunASR/zh/agent.html)。

首次运行前安装 Playwright Chromium：

```bash
corepack pnpm exec playwright install chromium
```

然后运行完整扩展 E2E：

```bash
corepack pnpm test:e2e
```

测试会先构建扩展、检查 FunASR 的 OpenAPI，再加载 `.output/chrome-mv3`。每次运行使用临时 Chromium Profile；IndexedDB 和扩展设置不会接触或污染日常使用的数据，结束后会自动清理。

Chrome 无头模式无法操作浏览器原生的“可选主机权限”弹窗，因此 `test:e2e` 仅在测试构建中把当前 `ASR_BASE_URL` 预授予为 `host_permissions`。普通开发和生产构建仍使用 `optional_host_permissions`，首次发送音频时必须由用户授权。

如果服务使用其他地址，可覆盖 Base URL：

```bash
ASR_BASE_URL=http://localhost:9000/v1 corepack pnpm test:e2e
```

OpenAPI 健康检查默认最多等待 60 秒。如果本地模型冷启动更慢，可设置 `ASR_HEALTH_TIMEOUT_MS`（毫秒）延长等待时间。

E2E fixture `e2e/fixtures/english-sample.wav` 以 CC0 公开，仅用于测试。由于真实模型输出可能随 FunASR 版本变化，E2E 断言稳定的产品行为，不逐字匹配完整转写内容。

词汇 E2E 会在 Playwright 网络边界模拟 DeepSeek `/chat/completions`，不得使用个人 API Key 或产生外部费用；它覆盖普通网页和逐句精听两个划词入口。GitHub Actions 不运行完整 E2E，因为 GitHub 托管 Runner 没有本项目所需的 CUDA FunASR 环境。提交 PR 前，请在具备条件时于本地运行 E2E，并在 PR 中说明结果。

## 提交前检查

```bash
corepack pnpm test
corepack pnpm build
git diff --check
```

提交应聚焦单一目的，并包含与行为变化相称的测试。PR 描述请说明：

- 解决的问题和用户可见变化；
- 验证命令及结果；
- 未覆盖的风险或后续工作；
- UI 改动的截图或录屏（如适用）。

请勿提交真实 API Key、个人学习数据、未授权音频、`.output` 构建产物或 Playwright 报告。
