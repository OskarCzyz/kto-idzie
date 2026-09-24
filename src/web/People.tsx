import { useState } from 'react'
import { FilterChips } from './parts'
import { Avatar, Thumb } from './ui'
import { STATUS_ICON, fullName, type Filter, type View } from './view'

/** Everyone in the group with their current choice per day; tap for their full ranking. */
export function People({ view, openPerson }: { view: View; openPerson: (pid: number) => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const days = view.state.camp.days
  const list = view.state.people.filter(
    (p) => view.matches(p, filter) && (!query.trim() || fullName(p).toLowerCase().includes(query.trim().toLowerCase())),
  )
  return (
    <>
      <div style={{ padding: '12px 16px 0' }}>
        <input className="input" placeholder="Szukaj osoby…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <FilterChips value={filter} onChange={setFilter} />
      <div className="people-head small muted">
        <span>{list.length} osób</span>
        <span className="sp" />
        {days.map((d) => <span key={d.id} className="people-col">D{d.dayNo}</span>)}
      </div>
      <div className="card">
        {list.map((p) => (
          <div key={p.id} className="person-row" onClick={() => openPerson(p.id)}>
            <Avatar person={p} me={p.id === view.me.id} size={30} />
            <div style={{ minWidth: 0 }}>
              <div className="ellipsis">{p.id === view.me.id ? `${p.firstName} (Ty)` : fullName(p)}</div>
              <div className="small muted">{p.bracket}</div>
            </div>
            <span className="sp" />
            {days.map((d) => {
              const c = view.res.currentChoice(p.id, d.id)
              const s = view.status(p.id, d.id)
              return (
                <span key={d.id} className="people-col" title={c != null ? view.activityOf(c).name : 'nic'}>
                  {c != null ? (
                    <span className="mini">
                      <Thumb activity={view.activityOf(c)} size={28} />
                      {s !== 'wondering' && <span className="mini-s">{STATUS_ICON[s]}</span>}
                    </span>
                  ) : (
                    <span className="mini empty">{(view.planOf(p.id).rankings[d.id]?.length ?? 0) > 0 ? '?' : ''}</span>
                  )}
                </span>
              )
            })}
          </div>
        ))}
        {!list.length && <div className="pad muted">Brak osób</div>}
      </div>
    </>
  )
}
