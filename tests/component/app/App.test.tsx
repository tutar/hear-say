import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'

describe('App', () => {
  it('renders the private audio-learning entrypoint', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Hear & Say' })).toBeInTheDocument()
    expect(screen.getByText('把一段真实英语，练成你能听懂、能开口说的内容。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '学习任务' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主菜单' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '学习' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '资料库' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '单词本' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '打开个人菜单' }))
    expect(screen.getByRole('menu')).toHaveTextContent('所有数据保存在本机')
    fireEvent.click(screen.getByRole('menuitem', { name: 'AI 服务' }))
    expect(screen.getByRole('heading', { name: 'AI 服务设置' })).toBeInTheDocument()
    expect(screen.getByLabelText('ASR 地址')).toBeInTheDocument()
    expect(screen.getByLabelText('DeepSeek API 地址')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '资料库' }))
    expect(screen.getByLabelText('选择音频文件')).toBeInTheDocument()
    expect(screen.getByText('正在读取本地材料…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('还没有材料。选一段你真想听懂的英语音频，从这里开始。')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '单词本' }))
    expect(screen.getByRole('heading', { name: '单词本' })).toBeInTheDocument()
    expect(screen.getByText('还没有积累单词')).toBeInTheDocument()
  })
})
