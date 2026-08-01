# Hear & Say

[English](README.md) | 简体中文

一个本地优先的 Chrome 扩展：把一段真实英语音频走完“听 → 看 → 跟 → 说”的学习循环，并通过网页与逐句精听中的主动划词建立语境单词本。

## 前置条件

- Node.js 24，以及项目通过 Corepack 声明的 pnpm 版本
- Chrome 114 或更高版本
- 可用的 OpenAI 兼容语音转写端点；默认是本机 FunASR：`http://localhost:8021/v1`，模型 `sensevoice`
- 可选的 DeepSeek API，用于生成语境词汇解释

## 本地开发与加载扩展

```bash
corepack pnpm install
corepack pnpm dev
```

创建生产构建：

```bash
corepack pnpm build
```

在 Chrome 打开 `chrome://extensions`，启用“开发者模式”，选择“加载已解压的扩展程序”，然后选择 `.output/chrome-mv3`。点击工具栏中的 Hear & Say 图标会在普通标签页打开学习页面。

## 安装发布版本

从项目的 [GitHub Releases](https://github.com/tutar/hear-say/releases) 下载 `hear-say-vX.Y.Z-chrome.zip`，解压后在 `chrome://extensions` 中通过“加载已解压的扩展程序”选择该目录。

GitHub 自动提供的 Source code 压缩包是源码，并不是可以直接加载的扩展包。

## 配置 AI 服务

在头像菜单的“AI 服务”页面配置音频转写和词汇解释。默认转写配置为：

```text
Base URL: http://localhost:8021/v1
模型: sensevoice
```

首次向某个 ASR 地址上传音频时，Chrome 会请求该地址的访问权限。若转写失败，材料和原始音频仍会保留，可以重试或导入 SRT/VTT 字幕恢复。

在普通网页或逐句精听中选中不超过八个英文单词后，扩展会显示“翻译”入口；只有点击后，选词及其所在句才会发送到已配置的 DeepSeek 兼容服务。只有点击“+ 生词本”才会保存词卡。

## 数据与密钥边界

- 音频、句子时间轴、难句标记、单词和学习进度存储在扩展本机 IndexedDB。
- API Key 仅保存在扩展本地存储中，不会显示在界面、错误信息或日志中。
- 音频只会发送到用户明确配置并授权的 ASR 端点。
- 网页内容脚本只响应主动划词，不扫描页面，也不读取可编辑区域。
- 词汇请求只包含选词和所在句，不包含网页 URL、标题、音频名称或整页内容。
- `tts` 权限只用于朗读用户主动播放的英文单词或短语。

## 验证

```bash
corepack pnpm test
corepack pnpm build
```

单元和组件测试位于 `tests/`；Playwright 扩展测试位于 `e2e/`，并使用本地 FunASR。完整环境准备、测试边界、贡献规则和发布流程见 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。
