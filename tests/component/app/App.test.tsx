import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/app/App'
import { resetDatabaseForTest } from '@/db/database'
import { RecordingRepository } from '@/db/recording-repository'
import { MaterialRepository } from '@/db/material-repository'

const savedSettings = new Map<string, unknown>()
vi.stubGlobal('browser', {
  storage: { local: { get: vi.fn(async (key: string) => ({ [key]: savedSettings.get(key) })), set: vi.fn(async (values: Record<string, unknown>) => Object.entries(values).forEach(([key, value]) => savedSettings.set(key, value))) } },
  tts: { speak: vi.fn(), stop: vi.fn() }, permissions: { contains: vi.fn(async () => true), request: vi.fn(async () => true) }, tabs: { create: vi.fn() },
})

describe('App', () => {
  beforeEach(async () => { savedSettings.clear(); await resetDatabaseForTest(); history.replaceState(null, '', '#/learning') })
  afterEach(cleanup)
  it('routes first open to settings and keeps transcription disabled until valid configuration is saved', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Hear & Say' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'AI 服务设置' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主菜单' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '学习' })).toHaveAttribute('href', '#/learning')
    expect(screen.getByRole('link', { name: '资料库' })).toHaveAttribute('href', '#/library')
    expect(screen.getByRole('link', { name: '单词本' })).toHaveAttribute('href', '#/words')
    expect(screen.getByLabelText('转写提供商')).toHaveValue('assemblyai')
    expect(screen.getByLabelText('DeepSeek API 地址')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: '资料库' }))
    expect(screen.getByLabelText('选择音频文件')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '打开个人菜单' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'AI 服务' }))
    fireEvent.change(screen.getAllByLabelText('API Key')[0], { target: { value: 'assembly-key' } })
    fireEvent.click(screen.getByRole('button', { name: '保存转写设置' }))
    await screen.findByRole('status', { name: '' })
    fireEvent.click(screen.getByRole('link', { name: '资料库' }))
    expect(screen.getByLabelText('选择音频文件')).toBeEnabled()
    expect(screen.getByText('正在读取本地材料…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('还没有材料。选一段你真想听懂的英语音频，从这里开始。')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('link', { name: '单词本' }))
    expect(screen.getByRole('heading', { name: '单词本' })).toBeInTheDocument()
    expect(screen.getByText('还没有积累单词')).toBeInTheDocument()
  })

  it('shows a recoverable error instead of rejecting when a recording draft has no persisted audio', async () => {
    savedSettings.set('asrSettings', { provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: 'key', model: 'universal-3-pro', language: 'en' })
    savedSettings.set('vocabularySettings', { baseUrl: 'https://api.deepseek.com', apiKey: 'key', model: 'deepseek-v4-flash' })
    await new RecordingRepository().saveDraft({ id: 'empty-draft', sessionId: 'empty-draft', state: 'interrupted', source: { title: 'Empty recording', url: 'https://example.com', site: 'example.com', recordedAt: '2026-08-01T10:00:00.000Z' }, durationSeconds: 0, sizeBytes: 0, excludedIntervals: [], createdAt: '2026-08-01T10:01:00.000Z', updatedAt: '2026-08-01T10:01:00.000Z' })
    history.replaceState(null, '', '#/recording-drafts/empty-draft')

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('这份录制草稿没有可播放的音频')
    expect(screen.queryByText('正在读取录制草稿…')).not.toBeInTheDocument()
  })

  it('persists blind-listening completion and renders intensive listening next', async () => {
    savedSettings.set('asrSettings', { provider: 'assemblyai', baseUrl: 'https://api.assemblyai.com/v2', apiKey: 'key', model: 'universal-3-5-pro', language: 'en' })
    savedSettings.set('vocabularySettings', { baseUrl: 'https://api.deepseek.com', apiKey: 'key', model: 'deepseek-v4-flash' })
    const repository = new MaterialRepository()
    const material = await repository.createPending({ title: 'lesson.wav', audioBlob: new Blob(['audio']), durationSeconds: 5 })
    await repository.replaceSegments(material.id, [{ id: 's1', materialId: material.id, order: 0, startSeconds: 0, endSeconds: 5, text: 'Listen closely.', isDifficult: false }])
    history.replaceState(null, '', `#/materials/${material.id}/practice`)

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: '完成全文盲听' }))

    expect(await screen.findByRole('heading', { name: '全文盲听完成' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '进入逐句精听' }))
    expect(await screen.findByRole('heading', { name: '逐句精听' })).toBeInTheDocument()
    await waitFor(async () => expect(await repository.getMaterial(material.id)).toMatchObject({ firstRoundStage: 'intensive_listen' }))
  })
})
