export function SpeakerIcon({ className = '' }: { className?: string }) {
  return <svg className={`speaker-icon ${className}`.trim()} aria-hidden="true" viewBox="0 0 24 24"><path d="M4 9.5v5h3.5l4.5 3.75V5.75L7.5 9.5H4Z"/><path className="speaker-wave" d="M15 9a4.25 4.25 0 0 1 0 6M17.75 6.5a7.6 7.6 0 0 1 0 11"/></svg>
}
