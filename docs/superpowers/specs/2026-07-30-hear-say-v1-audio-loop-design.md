# Hear & Say V1 音频学习闭环设计

## 背景与目标

Hear & Say 面向有一定英语基础的中国学习者，目标是以真实兴趣音频形成轻量的“听、说、复习”闭环。项目展示名为 `Hear & Say`，未来 GitHub 仓库 slug 为 `hear-say`。

本规格只定义 V1 的第一开发切片：本地导入音频后的听说学习闭环。它用于验证核心学习体验和本地 FunASR 接口，不实现完整 V1 的浏览词汇、统一单词本或 Chrome 标签页录音。

## 成功标准

用户可以导入一段真实英语音频，获得可编辑句级时间轴，完成盲听、精听、跟读和复述的首轮练习；刷新扩展后，材料、编辑结果、难句和学习状态仍然存在。

本切片不以零 ASR 错误为标准；标准是用户能低摩擦地修正文本或时间轴，并能用它完成逐句练习。

## 范围

### 包含

- 从扩展完整页选择并导入本地音频；
- 本地 IndexedDB 保存原始音频 Blob、材料元数据、句级分段、难句和学习状态；
- 可配置的 OpenAI Audio Transcriptions 兼容 ASR：默认 Base URL 为 `http://localhost:8021/v1`、模型为 `sensevoice`、响应格式为 `verbose_json`；
- 将 ASR 的 `segments[].start`、`segments[].end`、`segments[].text` 转换为内部句级时间轴；
- 编辑句子文本、合并相邻句子、拆分一句、微调开始和结束时间；
- 盲听、精听、跟读、复述四个首轮阶段；
- 难句标记，以及默认 `6 小时 → 1 → 2 → 4 → 7 → 14 → 28 天` 的材料复习安排；
- 转写失败后保留“待转写”材料，可重试或导入 SRT/VTT；
- 单元测试与扩展加载后的手工验收步骤。

### 不包含

- 网页划词、翻译、词汇卡与统一单词本；
- Side Panel、Chrome 当前标签页录音、后台监听或网页视频下载；
- 跟读/复述录音、ASR 反馈、发音评分和词级时间高亮；
- 自动意群、语法解析、复杂统计、跨设备同步和 Agent 建议；
- 对外账户、后端、云端密钥托管或多人协作。

## 技术决策

- 平台：Chrome 114+，Manifest V3。
- 工具链：WXT、React、TypeScript。
- 界面：先使用扩展完整页；不使用 Popup。Chrome Side Panel 留给后续标签页录音切片。
- 存储：IndexedDB；音频 Blob 和学习数据都仅保存在本机。
- ASR：浏览器直接向用户配置的兼容端点发送音频。默认本地 FunASR 使用 `sensevoice` 和 `verbose_json`；Base URL、API Key 和模型均可修改。API Key 不写入日志、导出内容或知识库。
- 时间轴：内部只承诺句级时间轴。`sensevoice` 已验证返回 `start`、`end` 与 `text`；词级时间轴不是本切片要求。

## 组件与数据流

```text
完整页
  ├─ 材料库：导入、显示状态、重试、进入练习
  ├─ 转写服务：读取 ASR 设置，上传音频，规范化 verbose_json
  └─ 练习页：播放器、句子编辑器、四阶段流程、难句与复习状态

IndexedDB
  ├─ materials：元数据、Blob、转写状态、复习时间
  └─ segments：文本、起止时间、难句标记、练习状态
```

导入后先创建 `pending_transcription` 材料，再上传音频。成功响应写入规范化分段并将材料标为 `ready`；失败保留材料和错误摘要，用户可重试或导入字幕。练习页只接受 `ready` 材料。

## 数据模型

```ts
type MaterialStatus = 'pending_transcription' | 'ready' | 'transcription_failed'

type Segment = {
  id: string
  materialId: string
  order: number
  startSeconds: number
  endSeconds: number
  text: string
  isDifficult: boolean
}

type Material = {
  id: string
  title: string
  audioBlob: Blob
  durationSeconds: number | null
  status: MaterialStatus
  transcriptionError: string | null
  firstRoundStage: 'blind_listen' | 'intensive_listen' | 'shadowing' | 'retelling' | 'complete'
  nextReviewAt: string | null
  createdAt: string
  updatedAt: string
}

type AsrSettings = {
  baseUrl: string
  apiKey: string
  model: string
}
```

编辑约束：每段必须满足 `0 <= startSeconds < endSeconds <= material.durationSeconds`（时长未知时仅约束开始小于结束）；相邻分段按 `order` 排序。合并会合并文本并取最早开始、最晚结束；拆分必须由用户指定分割位置和两个有效时间范围。

## 学习流程

1. 盲听：完整播放，隐藏所有句子文本；用户点击“完成盲听”进入下一阶段。
2. 精听：按句播放、循环和调速；用户可显示文本、编辑文本和标记难句。
3. 跟读：按句播放、循环和调速；用户自行开口后确认完成，不录音、不评分。
4. 复述：隐藏原文，仅显示材料标题和用户选择的关键词提示；用户自行复述后确认完成。
5. 首轮完成：为材料建立默认复习时间。复习优先呈现难句与段落复述；用户可在使用时调整实际完成时间，但本切片不提供可配置的间隔算法。

## 隐私与错误边界

- 只有用户明确导入的音频才会上传至 ASR；不上传网页 URL、标题或浏览历史。
- 用户配置的 API Key 仅保存在扩展本地存储，且永不写入导出、日志或页面文本。
- ASR 无法访问、超时、响应缺少有效句级分段，或分段时间非法时，保留材料并展示可操作错误；不丢失原始音频。
- 导入字幕时必须验证每段时间范围和排序；无效字幕不覆盖已有可用分段。

## 测试与验收

### 自动化测试

- ASR `verbose_json` 正常化：有效分段、空分段、非法时间与缺少字段；
- 分段编辑：修改、合并、拆分与时间边界验证；
- 复习调度：首轮完成后产生 6 小时复习时间，并正确推进默认序列；
- IndexedDB 数据访问：保存、读取、失败状态保留和删除材料；
- 学习阶段状态机：四阶段的合法推进，不允许跳过未完成状态。

### 手工验收

1. 在 Chrome 加载开发版扩展，打开完整页。
2. 导入一段真实英语音频，使用本地 FunASR `sensevoice` 转写。
3. 确认句子文本与时间轴出现，至少完成一次文本编辑、合并/拆分和时间微调。
4. 完成盲听、精听、跟读和复述四阶段，标记至少一个难句。
5. 刷新扩展，确认材料、编辑内容、难句、阶段与下次复习时间仍在。
6. 将 ASR 地址改为不可达地址，确认材料被保留为失败状态且可重试。

## 后续切片

第二切片加入浏览词汇与统一单词本。第三切片加入 Side Panel 主动录制当前标签页音频，并验证录音产物可进入本切片定义的转写与练习流程。

## 决策依据

- `00-core/principles/the-bitter-lesson.md`：在产品与技术决策中保留可替换 ASR 接口，并以真实材料的反馈而非单一模型宣传决定后续选择。
- `00-core/principles/build-in-public.md` 与 `00-core/principles/learn-in-public.md` 不适用于此私密学习工具的内部实现与音频处理，不作为公开授权。
