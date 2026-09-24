import type { ReactNode } from 'react'
import type { Activity, PersonDto } from '../shared/api'

const HUES = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774', '#5a8fbb']

export function Avatar({ person, me, size = 24 }: { person: PersonDto; me?: boolean; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.42, background: HUES[person.id % HUES.length] }
  return person.photoUrl ? (
    <img className={`av ${me ? 'me' : ''}`} style={style} src={person.photoUrl} alt="" />
  ) : (
    <span className={`av ${me ? 'me' : ''}`} style={style}>{person.firstName.slice(0, 2)}</span>
  )
}

/** First photo of the activity, or a coloured tile with its initial. */
export function Thumb({ activity, size = 44 }: { activity: Activity; size?: number }) {
  const photo = activity.photos[0]
  if (photo) return <img src={photo.url} className="thumb" style={{ width: size, height: size }} alt="" />
  return (
    <span className="thumb" style={{ width: size, height: size, background: HUES[activity.id % HUES.length], color: '#fff', fontWeight: 700, fontSize: size * 0.4 }}>
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
