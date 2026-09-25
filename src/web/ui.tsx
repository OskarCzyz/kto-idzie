import { useState, type ReactNode } from 'react'
import type { Activity, PersonDto } from '../shared/api'

const HUES = ['#c9716f', '#6fae7a', '#5d93c4', '#9a87d6', '#c872a0', '#5faeab', '#d19a62', '#6d8fb0']
// Dark tiles with a light accent, like the category tiles in the BCC event app.
const TILES: [string, string][] = [['#1f3a26', '#9fd6a3'], ['#4a1a2e', '#f0a3c0'], ['#16306b', '#f6e7c9'], ['#123b3a', '#8fd1c6'], ['#3a2450', '#cdb6f5'], ['#43301a', '#f0c98a']]

export function Avatar({ person, me, size = 24 }: { person: PersonDto; me?: boolean; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.42, background: HUES[person.id % HUES.length] }
  return person.photoUrl ? (
    <img className={`av ${me ? 'me' : ''}`} style={style} src={person.photoUrl} alt="" />
  ) : (
    <span className={`av ${me ? 'me' : ''}`} style={style}>{person.firstName.slice(0, 2)}</span>
  )
}

/** The activity's logo on its tile, or a coloured tile with its initial. */
export function Thumb({ activity, size = 44 }: { activity: Activity; size?: number }) {
  const [bg] = TILES[activity.id % TILES.length]!
  if (activity.logoUrl) return <img src={activity.logoUrl} className="thumb" style={{ width: size, height: size, background: bg }} alt="" />
  return (
    <span className="thumb" style={{ width: size, height: size, background: TILES[activity.id % TILES.length]![0], color: TILES[activity.id % TILES.length]![1], fontFamily: 'var(--serif)', fontWeight: 700, fontSize: size * 0.45 }}>
      {activity.name.slice(0, 1)}
    </span>
  )
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  )
}

export type Choose = (question: string, options: string[]) => Promise<number | null>

/** A question with several answers in a bottom sheet. Resolves the chosen index, or null when dismissed. */
export function useChoice(): [ReactNode, Choose] {
  const [q, setQ] = useState<{ question: string; options: string[]; resolve: (i: number | null) => void } | null>(null)
  const choose: Choose = (question, options) => new Promise((resolve) => setQ({ question, options, resolve }))
  const close = (i: number | null) => {
    q?.resolve(i)
    setQ(null)
  }
  const sheet = q && (
    <Sheet onClose={() => close(null)}>
      <div className="sec b" style={{ fontSize: 16 }}>{q.question}</div>
      <div className="sec" style={{ display: 'grid', gap: 8 }}>
        {q.options.map((o, i) => <button key={o} className={`btn ${i ? 'ghost' : ''}`} onClick={() => close(i)}>{o}</button>)}
      </div>
    </Sheet>
  )
  return [sheet, choose]
}
