import type { ReactNode } from 'react'

const playbackRates = Array.from({ length: 16 }, (_, index) => (index + 5) / 10)

export function PlayerSelect({ label, ariaLabel, value, onChange, children, compact = false }: { label: string; ariaLabel: string; value: string | number; onChange: (value: string) => void; children: ReactNode; compact?: boolean }) {
  return <label className={`playback-rate-control ${compact ? 'is-compact' : ''}`}><span>{label}</span><span className="playback-rate-select"><select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select><svg aria-hidden="true" viewBox="0 0 12 8"><path d="m1 1.5 5 5 5-5" /></svg></span></label>
}

export function PlaybackRateSelect({ value, onChange, compact = false }: { value: number; onChange: (value: number) => void; compact?: boolean }) {
  return <PlayerSelect label={compact ? '速度' : '播放速度'} ariaLabel="播放速度" value={value} compact={compact} onChange={(next) => onChange(Number(next))}>{playbackRates.map((rate) => <option key={rate} value={rate}>{rate.toFixed(1)}×</option>)}</PlayerSelect>
}

export function PlayGlyph({ playing }: { playing: boolean }) {
  return <span className="player-glyph" aria-hidden="true">{playing ? <svg className="pause-mark" viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg> : <svg className="play-mark" viewBox="0 0 24 24"><path d="M8 5 20 12 8 19Z" /></svg>}</span>
}

export function StepGlyph({ direction }: { direction: 'previous' | 'next' }) {
  return <svg className="step-glyph" aria-hidden="true" viewBox="0 0 24 24"><path d={direction === 'previous' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} /></svg>
}
