import { useState } from 'react'
import { addPick, keepOnAllDays, removePick, setDayStatus, type Plan, type StoredDayStatus } from '../domain'
import { FilterChips, GoersLine } from './parts'
import { Ranking } from './Ranking'
import { confirmAsync } from './telegram'
import { Avatar, Thumb } from './ui'
import { STATUS_ICON, STATUS_LABEL, eligibilityText, type Filter, type View } from './view'

export interface DayProps {
  view: View
  day: number
  edit: (change: (plan: Plan) => Plan) => void
  openOffering: (oid: number) => void
  openPerson: (pid: number) => void
  openCondition: (oid: number) => void
}

export function Day({ view, day, edit, openOffering, openPerson, openCondition }: DayProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const me = view.me.id
  const ranking = view.myPlan.rankings[day] ?? []
  const current = view.res.currentChoice(me, day)
  const status = view.status(me, day)
  const conflicts = view.res.conflicts(me).filter((oid) => view.offering(oid).dayIds.includes(day))

  const found = query.trim()
    ? view.state.people.filter((p) => p.id !== me && `${p.firstName} ${p.lastName ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 3)
    : []
  const others = view
    .offeringsOn(day)
    .filter((o) => !ranking.includes(o.id) && (showAll || view.eligibleForMe(o)))
    .sort((a, b) => view.goers(b.id, day, filter).length - view.goers(a.id, day, filter).length)
  const undecided = view.undecided(day, filter)

  // Same activity as current choice on several days is allowed but not encouraged.
  const currentActivity = current != null ? view.offering(current).activityId : null
  const repeatedOn = view.state.camp.days.filter((d) => {
    const c = d.id !== day ? view.res.currentChoice(me, d.id) : null
    return c != null && current != null && c !== current && view.offering(c).activityId === currentActivity
  })

  async function setStatus(s: StoredDayStatus) {
    const top = ranking[0]
    if (s !== 'wondering' && top != null && current !== top) {
      const ok = await confirmAsync(`„${view.activityOf(top).name}” to Twoje #1, ale jego warunek teraz nie jest spełniony. Zdecydowany oznacza, że idziesz na #1 mimo to. OK?`)
      if (!ok) return
    }
    edit((p) => setDayStatus(p, day, s, view.offerings))
  }

  return (
    <>
      <div className="now">
        <div className="small muted">Gdyby zapisy były teraz, poszedłbyś na:</div>
        {current != null ? (
          <div className="row" style={{ marginTop: 6 }} onClick={() => openOffering(current)}>
            <Thumb activity={view.activityOf(current)} />
            <div>
              <div className="b" style={{ fontSize: 18 }}>{view.activityOf(current).name}</div>
              <div className="small muted">z Tobą: {view.goers(current, day).length - 1} os.{view.daysText(view.offering(current)) && ` · ${view.daysText(view.offering(current))}`}</div>
            </div>
          </div>
        ) : (
          <div className="b" style={{ marginTop: 4 }}>{ranking.length ? '— żaden warunek nie jest teraz spełniony' : '— dodaj coś do rankingu poniżej'}</div>
        )}
        {ranking.length > 0 && (
          <div className="status">
            {(['wondering', 'decided', 'registered'] as const).map((s) => (
              <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{STATUS_ICON[s]} {STATUS_LABEL[s]}</button>
            ))}
          </div>
        )}
      </div>

      {conflicts.map((oid) => {
        const o = view.offering(oid)
        const name = view.activityOf(oid).name
        const preferred = o.dayIds
          .filter((d) => view.myPlan.rankings[d]?.[0] !== oid)
          .map((d) => `dzień ${view.dayNo(d)}: ${view.activityOf(view.myPlan.rankings[d]![0]!).name}`)
        return (
          <div key={oid} className="warn">
            ⚠️ <b>{name}</b> trwa {view.daysText(o)}, ale wolisz coś innego ({preferred.join(', ')}). Dopóki nie wybierzesz, {name} się nie liczy.
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => edit((p) => keepOnAllDays(p, view.domainOffering(oid)))}>{name} we wszystkie dni</button>
              <button className="btn sm ghost" onClick={() => edit((p) => removePick(p, view.domainOffering(oid)))}>Usuń {name}</button>
            </div>
          </div>
        )
      })}
      {repeatedOn.length > 0 && (
        <div className="warn">ℹ️ „{view.activityOf(current!).name}” wybierasz też w dniu {repeatedOn.map((d) => d.dayNo).join(', ')}. Można, ale nie jest to zalecane.</div>
      )}

      <div className="h3">Twój ranking ({ranking.length})</div>
      <Ranking view={view} day={day} filter={filter} edit={edit} openOffering={openOffering} openCondition={openCondition} />

      <div className="h3">Pozostałe opcje</div>
      <FilterChips value={filter} onChange={setFilter} />
      <div style={{ padding: '0 16px' }}>
        <input className="input" placeholder="Gdzie idzie… (wpisz imię)" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {found.map((p) => {
        const c = view.res.currentChoice(p.id, day)
        const n = view.planOf(p.id).rankings[day]?.length ?? 0
        return (
          <div key={p.id} className="find" onClick={() => openPerson(p.id)}>
            <Avatar person={p} />
            <span><b>{p.firstName}</b> → {c != null ? `${view.activityOf(c).name} ${STATUS_ICON[view.status(p.id, day)]}` : 'jeszcze nic'}{n > 1 && <span className="muted"> (rozważa {n})</span>}</span>
          </div>
        )
      })}
      {others.map((o) => {
        const activity = view.activityOf(o.id)
        const eligible = view.eligibleForMe(o)
        const highlighted = found.some((p) => view.res.currentChoice(p.id, day) === o.id)
        return (
          <div key={o.id} className={`opt ${highlighted ? 'hl' : ''}`} style={eligible ? undefined : { opacity: 0.5 }}>
            <Thumb activity={activity} />
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => openOffering(o.id)}>
              <div className="b">{activity.name}</div>
              <div className="small muted">
                {[view.daysText(o), eligibilityText(o), o.capacity ? `max ${o.capacity}` : '', o.highDemand ? '🔥' : ''].filter(Boolean).join(' · ')}
              </div>
              <GoersLine view={view} oid={o.id} day={day} filter={filter} />
            </div>
            {eligible && (
              <div className="add">
                <button className="btn sm" onClick={() => edit((p) => addPick(p, view.domainOffering(o.id)))}>+ Dodaj</button>
                <button className="btn sm ghost" onClick={() => { edit((p) => addPick(p, view.domainOffering(o.id))); openCondition(o.id) }}>+ Jeśli…</button>
              </div>
            )}
          </div>
        )
      })}
      {!others.length && <div className="card pad muted small">Wszystko jest już w Twoim rankingu.</div>}
      <div className="card pad small">
        <b>🙋 Jeszcze nic nie wybrali ({undecided.length}):</b> {undecided.map((p) => (p.id === me ? 'Ty' : p.firstName)).join(', ') || '—'}
      </div>
      <div style={{ textAlign: 'center' }}>
        <button className="chip" onClick={() => setShowAll(!showAll)}>{showAll ? 'Ukryj niedostępne' : 'Pokaż też niedostępne'}</button>
      </div>
    </>
  )
}
