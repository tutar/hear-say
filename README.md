# Hear & Say

一个本地优先的 Chrome 扩展：把一段英语音频走完“听 → 看 → 跟 → 说”的学习循环，并通过网页与逐句精听中的主动划词建立语境单词本。

## 前置条件

- Node.js LTS 与 pnpm（项目通过 Corepack 使用 pnpm）
- Chrome 114 或更高版本
- 可用的 OpenAI 兼容语音转写端点；默认是本机 FunASR：`http://localhost:8021/v1`，模型 `sensevoice`
- 可选的 DeepSeek API；词汇解释默认使用 `https://api.deepseek.com` 和 `deepseek-v4-flash`

## 本地开发与加载扩展

```bash
corepack pnpm install
corepack pnpm dev
```

开发模式会生成 Chrome 扩展构建。也可以创建生产构建：

```bash
corepack pnpm build
```

在 Chrome 打开 `chrome://extensions`，启用「开发者模式」，选择「加载已解压的扩展程序」，并选择 `.output/chrome-mv3`。点击工具栏中的 Hear & Say 图标会在普通标签页打开完整学习页面。

## 配置转写

在头像菜单的「AI 服务」页面分别配置音频转写和词汇解释。默认转写配置适配：

```text
Base URL: http://localhost:8021/v1
模型: sensevoice
```

首次向某个 ASR 地址上传音频时，Chrome 会请求该地址的访问权限。这是为了让扩展仅在你明确配置和同意的端点上发送你主动选择的音频。若转写不可用，材料和原始音频仍会保留，可以重试或导入 SRT/VTT 字幕恢复。

普通网页或逐句精听中选中不超过 8 个英文单词后，扩展只显示“翻译”入口；点击后才把选词及其所在句发送到已配置的 DeepSeek 兼容服务。点击 `+ 生词本` 才会保存词卡。单词、语境释义、原句和来源仅存储在扩展本机 IndexedDB。

## 数据与密钥边界

- 音频、句子时间轴、难句标记和学习进度存储在扩展本机 IndexedDB。
- API Key 仅保存在扩展本地存储，以密码字段编辑；不会在界面、错误提示或日志中显示。
- 音频只在你主动导入后发送到配置且授权的 ASR 端点。
- 网页 content script 仅在用户主动划词时读取选区；不扫描页面，不读取输入框或可编辑区域。
- DeepSeek 只收到选词和所在句，不收到网页 URL、标题、音频名称或整页内容。
- `tts` 权限只用于通过 Chrome 系统语音朗读用户点击的英文词条或短语。

## 验证

```bash
corepack pnpm test
corepack pnpm build
```

单元和组件测试位于顶层 `tests/`；针对构建后 Chrome 扩展的 Playwright E2E 位于 `e2e/`，并使用本地 FunASR。完整的环境准备、测试边界和提交要求见 [CONTRIBUTING.md](CONTRIBUTING.md)。

手动验收路径：

1. 加载 `.output/chrome-mv3`，从工具栏打开扩展。
2. 使用本地 FunASR `sensevoice` 导入一段真实英语音频。
3. 编辑一句文本，合并或拆分句子，调整一个时间戳，并标记一个难句。
4. 完成“听、看、跟、说”四个阶段；复述阶段可填写自己的关键词。
5. 刷新页面，确认材料、编辑和学习进度仍在；到期后从复习队列完成一次复习。
6. 将 ASR 地址临时改为不可达，导入另一段音频，确认可重试；再导入有效 SRT/VTT 字幕完成恢复。

删除确认框应显示“音频、句子时间轴与学习记录将一并永久删除”；取消后材料保持不变，确认后刷新页面也不再出现该材料。
