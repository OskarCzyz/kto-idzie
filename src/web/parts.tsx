// Small presentational pieces shared by the day screen and sheets.
import { Avatar } from './ui'
import type { Filter, View } from './view'

/** Avatars and first names of the others going to an offering on a day. */
export function GoingWith({ view, oid, day }: { view: View; oid: number; day: number }) {
  const goers = view.goers(oid, day).filter((p) => p.id !== view.me.id)
  if (!goers.length) return <span className="small muted">nikt jeszcze nie idzie</span>
  return (
    <span className="row small" style={{ gap: 4 }}>
      <span className="stack">{goers.slice(0, 4).map((p) => <Avatar key={p.id} person={p} size={18} />)}</span>
      <span className="muted">{goers.slice(0, 2).map((p) => p.firstName).join(', ')}{goers.length > 2 && ` +${goers.length - 2}`}</span>
    </span>
  )
}

export function FilterChips({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const opts: [Filter, string][] = [['all', 'Wszyscy'], ['M', 'Chłopcy'], ['K', 'Dziewczyny'], ['mine', 'Mój rocznik']]
  return (
    <div className="chips">
      {opts.map(([k, l]) => (
        <button key={k} className={`chip ${value === k ? 'on' : ''}`} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  )
}
