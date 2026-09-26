// Browse by activity: where is it happening and how many of us go there, per camp day.
import { useState } from 'react'
import { CATEGORIES, type Activity, type PersonDto } from '../shared/api'
import { FilterChips } from './parts'
import { Avatar, Thumb } from './ui'
import { eligibilityText, type Filter, type View } from './view'

type Slot = { oid: number; day: number; goers: PersonDto[] }
type Row = { activity: Activity; slots: Slot[]; goers: PersonDto[]; considering: number }

/** Every activity with the people for whom it is the current choice; tap a day to see who exactly. */
export function Activities({ view, openOffering }: { view: View; openOffering: (oid: number, day: number) => void }) {
  const [day, setDay] = useState<number | null>(null) // null = all days
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<'popular' | 'category'>('popular')
  const days = view.state.camp.days

  const rows: Row[] = view.state.activities
    .map((activity) => {
      const slots = view.state.offerings
        .filter((o) => o.activityId === activity.id)
        .flatMap((o) => o.dayIds.filter((d) => day == null || d === day).map((d) => ({ oid: o.id, day: d, goers: view.goers(o.id, d, filter) })))
        .sort((a, b) => view.dayNo(a.day) - view.dayNo(b.day))
      const goers = [...new Map(slots.flatMap((s) => s.goers).map((p) => [p.id, p])).values()]
      const considering = new Set(slots.flatMap((s) => view.considering(s.oid, s.day, filter).map((p) => p.id)).filter((id) => !goers.some((p) => p.id === id))).size
      return { activity, slots, goers, considering }
    })
    .filter((r) => r.slots.length)
    .sort((a, b) => b.goers.length - a.goers.length || b.considering - a.considering || a.activity.name.localeCompare(b.activity.name, 'pl'))

  const groups =
    sort === 'category'
      ? [...CATEGORIES, null].map((c) => ({ name: c ?? 'Inne', rows: rows.filter((r) => r.activity.category === c) })).filter((g) => g.rows.length)
      : [{ name: null, rows }]

  return (
    <>
      <h2 className="q" style={{ paddingTop: 14 }}>Gdzie się dzieje?</h2>
      <div className="small muted" style={{ padding: '2px 16px 0' }}>Ile osób idzie na każdą aktywność. Dotknij, żeby zobaczyć kto.</div>
      <div className="chips">
        <button className={`chip ${day == null ? 'on' : ''}`} onClick={() => setDay(null)}>Wszystkie dni</button>
        {days.map((d) => (
          <button key={d.id} className={`chip ${day === d.id ? 'on' : ''}`} onClick={() => setDay(d.id)}>Dzień {d.dayNo}</button>
        ))}
      </div>
      <FilterChips value={filter} onChange={setFilter} />
      <div className="chips" style={{ paddingTop: 0 }}>
        <button className={`chip ${sort === 'popular' ? 'on' : ''}`} onClick={() => setSort('popular')}>Najpopularniejsze</button>
        <button className={`chip ${sort === 'category' ? 'on' : ''}`} onClick={() => setSort('category')}>Według kategorii</button>
      </div>
      {groups.map((grp) => (
        <div key={grp.name ?? 'all'}>
          {grp.name && <div className="h3">{grp.name}</div>}
          <div className="card">
            {grp.rows.map((r) => <ActivityRow key={r.activity.id} view={view} row={r} showDay={day == null} openOffering={openOffering} />)}
          </div>
        </div>
      ))}
      {!rows.length && <div className="card pad small muted">Brak aktywności na ten dzień.</div>}
    </>
  )
}

function ActivityRow({ view, row, showDay, openOffering }: { view: View; row: Row; showDay: boolean; openOffering: (oid: number, day: number) => void }) {
  const { activity, slots, goers, considering } = row
  const busiest = [...slots].sort((a, b) => b.goers.length - a.goers.length)[0]!
  // Two offerings of one activity on the same day differ by who may go; say which is which.
  const label = (s: Slot) => {
    const twin = slots.some((x) => x !== s && x.day === s.day)
    const who = twin ? eligibilityText(view.offering(s.oid)).replace('tylko ', '') : ''
    return [showDay || twin ? `Dz. ${view.dayNo(s.day)}` : '', who].filter(Boolean).join(' ')
  }
  const chips = slots.length > 1 || (showDay && slots.length === 1)
  return (
    <div className="person-row" style={{ alignItems: 'flex-start' }} onClick={() => openOffering(busiest.oid, busiest.day)}>
      <Thumb activity={activity} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="b ellipsis">{activity.name}</div>
        {goers.length ? (
          <span className="row small" style={{ gap: 4 }}>
            <span className="stack">{goers.slice(0, 5).map((p) => <Avatar key={p.id} person={p} size={18} me={p.id === view.me.id} />)}</span>
            <span className="muted ellipsis">{goers.slice(0, 3).map((p) => (p.id === view.me.id ? 'Ty' : p.firstName)).join(', ')}{goers.length > 3 && ` +${goers.length - 3}`}</span>
          </span>
        ) : (
          <div className="small muted">nikt jeszcze nie idzie{considering > 0 && ` · ${considering} ma jako zapas`}</div>
        )}
        {chips && (
          <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
            {slots.map((s) => (
              <button key={`${s.oid}-${s.day}`} className="badge" onClick={(e) => { e.stopPropagation(); openOffering(s.oid, s.day) }}>
                {label(s)} · <b style={{ color: s.goers.length ? 'var(--text)' : undefined }}>{s.goers.length}</b>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flex: 'none' }}>
        <div className="b" style={{ fontSize: 20, lineHeight: 1.1 }}>{goers.length}</div>
        <div className="small muted">idzie</div>
      </div>
    </div>
  )
}
