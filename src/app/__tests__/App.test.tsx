import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'

describe('App', () => {
  it('renders the private audio-learning entrypoint', async () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Hear & Say' })).toBeInTheDocument()
    expect(screen.getByText('把一段真实英语，练成你能听懂、能开口说的内容。')).toBeInTheDocument()
    expect(screen.getByLabelText('选择音频文件')).toBeInTheDocument()
    expect(screen.getByText('正在读取本地材料…')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('还没有材料。选一段你真想听懂的英语音频，从这里开始。')).toBeInTheDocument())
  })
})
