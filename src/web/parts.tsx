// Small presentational pieces shared by the day screen, ranking and sheets.
import { STATUS_ICON, type Filter, type View } from './view'

const firstName = (view: View, id: number) => (id === view.me.id ? 'Ty' : (view.person(id)?.firstName ?? '?'))

/** "Idą: Kasia 🎟️, Tomek ✅, Ola 🤔 +3 · rozważa 5" */
export function GoersLine({ view, oid, day, filter }: { view: View; oid: number; day: number; filter: Filter }) {
  const goers = view.goers(oid, day, filter).filter((p) => p.id !== view.me.id)
  const considering = view.considering(oid, day, filter).filter((p) => p.id !== view.me.id)
  return (
    <div className="names">
      {goers.length ? (
        <>
          Idą:{' '}
          {goers.slice(0, 4).map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <b>{p.firstName}</b> {STATUS_ICON[view.status(p.id, day)]}
            </span>
          ))}
          {goers.length > 4 && <span className="muted"> +{goers.length - 4}</span>}
        </>
      ) : (
        <span className="muted">Nikt jeszcze tu nie idzie</span>
      )}
      {considering.length > 0 && <span className="muted"> · rozważa {considering.length}</span>}
    </div>
  )
}

/** "🤝 jeśli Tomek · idziecie razem" / "🤝 jeśli min. 3 chłopców · ⏳ jeszcze nie" */
export function ConditionLine({ view, pid, oid, day }: { view: View; pid: number; oid: number; day: number }) {
  const c = view.planOf(pid).conditions[oid]
  if (!c) return null
  const person = view.person(pid)
  const who =
    c.kind === 'people'
      ? 'jeśli ' + c.people.map((q) => firstName(view, q)).join(' i ')
      : `jeśli min. ${c.min} ${person?.gender === 'K' ? 'dziewczyn' : 'chłopców'}`
  const met = view.res.conditionMet(pid, oid, day)
  const together =
    c.kind === 'people' &&
    c.people.some((q) => {
      const theirs = view.planOf(q).conditions[oid]
      return theirs?.kind === 'people' && theirs.people.includes(pid) && view.res.currentChoice(q, day) === oid
    })
  return (
    <div className="small" style={{ marginTop: 3 }}>
      <span style={{ color: 'var(--cond)' }}>🤝 {who}</span> ·{' '}
      {met ? <b style={{ color: 'var(--ok)' }}>{together ? 'idziecie razem' : '✓ spełniony'}</b> : <b style={{ color: 'var(--wait)' }}>⏳ jeszcze nie</b>}
    </div>
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
