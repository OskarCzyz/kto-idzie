import { useState } from 'react'
import { setCondition, type Condition, type Plan } from '../domain'
import { ConditionLine } from './parts'
import { Avatar, Sheet, Thumb } from './ui'
import { STATUS_ICON, STATUS_LABEL, eligibilityText, fullName, toDomainOffering, type View } from './view'
import { eligible } from '../domain'

export function OfferingSheet({ view, oid, day, onClose, openPerson }: { view: View; oid: number; day: number; onClose: () => void; openPerson: (pid: number) => void }) {
  const o = view.offering(oid)
  const a = view.activityOf(oid)
  const d = o.dayIds.includes(day) ? day : o.dayIds[0]!
  const goers = view.goers(oid, d)
  const considering = view.considering(oid, d)
  return (
    <Sheet onClose={onClose}>
      <div className="sec" style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
        <Thumb activity={a} size={120} />
      </div>
      <div className="sec" style={{ textAlign: 'center' }}>
        <div className="b" style={{ fontSize: 19 }}>{a.name}</div>
        <div className="small muted">{o.dayIds.map((x) => `Dzień ${view.dayNo(x)}`).join(', ')}{eligibilityText(o) && ` · ${eligibilityText(o)}`}</div>
        {a.description && <div className="small" style={{ margin: '6px 0' }}>{a.description}</div>}
        <span className="badge">{o.capacity ? `max ${o.capacity} · nas ${goers.length}` : 'bez limitu'}</span>{' '}
        {o.highDemand && <span className="badge hot">🔥 duże zainteresowanie</span>}
      </div>
      <div className="sec">
        <div className="sec-title">Idą – obecny wybór ({goers.length})</div>
        {(['registered', 'decided', 'wondering'] as const).map((s) => {
          const g = goers.filter((p) => view.status(p.id, d) === s)
          if (!g.length) return null
          return (
            <div key={s}>
              <div className="small b" style={{ margin: '4px 0' }}>{STATUS_ICON[s]} {STATUS_LABEL[s]} · {g.length}</div>
              {g.map((p) => <span key={p.id} className="namechip" onClick={() => openPerson(p.id)}><Avatar person={p} size={20} me={p.id === view.me.id} />{p.id === view.me.id ? 'Ty' : p.firstName}</span>)}
            </div>
          )
        })}
        {!goers.length && <span className="muted">nikt</span>}
      </div>
      <div className="sec">
        <div className="sec-title">Rozważają ({considering.length})</div>
        {considering.map((p) => (
          <span key={p.id} className="namechip" onClick={() => openPerson(p.id)}>
            <Avatar person={p} size={20} me={p.id === view.me.id} />{p.id === view.me.id ? 'Ty' : p.firstName} <span className="rk">#{(view.planOf(p.id).rankings[d] ?? []).indexOf(oid) + 1}</span>
            {view.planOf(p.id).conditions[oid] && ' 🤝'}
          </span>
        ))}
        {!considering.length && <span className="muted">nikt</span>}
      </div>
    </Sheet>
  )
}

export function PersonSheet({ view, pid, onClose }: { view: View; pid: number; onClose: () => void }) {
  const p = view.person(pid)
  if (!p) return null
  const plan = view.planOf(pid)
  return (
    <Sheet onClose={onClose}>
      <div className="sec row">
        <Avatar person={p} size={44} />
        <div>
          <div className="b" style={{ fontSize: 18 }}>{fullName(p)}</div>
          <div className="small muted">{p.gender === 'K' ? 'dziewczyna' : 'chłopak'} · {p.bracket}{p.username && ` · @${p.username}`}</div>
        </div>
      </div>
      {view.state.camp.days.map((d) => {
        const ranking = plan.rankings[d.id] ?? []
        const current = view.res.currentChoice(pid, d.id)
        const s = view.status(pid, d.id)
        return (
          <div key={d.id} className="sec" style={{ borderTop: '1px solid var(--line)' }}>
            <div className="row"><b>Dzień {d.dayNo}</b><span className="sp" /><span className="small">{STATUS_ICON[s]} {STATUS_LABEL[s]}</span></div>
            {ranking.length ? (
              ranking.map((oid, i) => (
                <div key={oid} className="small" style={{ marginTop: 4, fontWeight: oid === current ? 700 : 400, color: oid === current ? undefined : 'var(--muted)' }}>
                  {i + 1}. {view.activityOf(oid).name}{oid === current && ' ← idzie'}
                  <ConditionLine view={view} pid={pid} oid={oid} day={d.id} />
                </div>
              ))
            ) : (
              <div className="small muted">nic</div>
            )}
          </div>
        )
      })}
    </Sheet>
  )
}

export function ConditionSheet({ view, oid, day, edit, onClose }: { view: View; oid: number; day: number; edit: (change: (plan: Plan) => Plan) => void; onClose: () => void }) {
  const existing = view.myPlan.conditions[oid]
  const [mode, setMode] = useState<Condition['kind']>(existing?.kind ?? 'people')
  const [people, setPeople] = useState<number[]>(existing?.kind === 'people' ? existing.people : [])
  const [min, setMin] = useState(existing?.kind === 'min' ? existing.min : 2)
  const [query, setQuery] = useState('')
  const o = view.offering(oid)
  const activity = view.activityOf(oid)
  const me = view.me
  const own = me.gender === 'K' ? 'dziewczyn' : 'chłopców'
  const candidates = view.state.people
    .filter((p) => p.id !== me.id && eligible(p, toDomainOffering(o)) && (!query || fullName(p).toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => Number(people.includes(b.id)) - Number(people.includes(a.id)))
  const toggle = (id: number) => setPeople((ps) => (ps.includes(id) ? ps.filter((x) => x !== id) : [...ps, id]))
  const sameGenderGoing = view.goers(oid, day).filter((p) => p.id !== me.id && p.gender === me.gender).length

  function save(c: Condition | null) {
    edit((p) => setCondition(p, oid, c))
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sec">
        <div className="b" style={{ fontSize: 18 }}>{activity.name}: pójdę, jeśli…</div>
        <div className="small muted" style={{ marginTop: 3 }}>Warunek jest spełniony, gdy te osoby mają to jako swój <b>obecny wybór</b>.</div>
      </div>
      <div className="sec seg">
        <button className={mode === 'people' ? 'on' : ''} onClick={() => setMode('people')}>Konkretne osoby</button>
        <button className={mode === 'min' ? 'on' : ''} onClick={() => setMode('min')}>Min. {own}</button>
      </div>
      {mode === 'people' ? (
        <div className="sec">
          {people.map((id) => {
            const p = view.person(id)
            return p && <span key={id} className="namechip"><Avatar person={p} size={20} />{p.firstName} <button onClick={() => toggle(id)}>✕</button></span>
          })}
          {!people.length && <span className="muted small">Nikt nie wybrany</span>}
          <input className="input" style={{ marginTop: 8 }} placeholder="Szukaj osoby…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {candidates.slice(0, 8).map((p) => {
            const c = view.res.currentChoice(p.id, day)
            const considers = (view.planOf(p.id).rankings[day] ?? []).includes(oid)
            return (
              <button key={p.id} className="pi" onClick={() => toggle(p.id)}>
                <Avatar person={p} />
                <span>{fullName(p)}</span>
                <span className="sp" />
                <span className="small muted">{c === oid ? 'idzie' : considers ? 'rozważa' : ''}</span>
                <span>{people.includes(p.id) ? '☑️' : '⬜'}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="sec">
          <div className="stepper">
            <button onClick={() => setMin(Math.max(1, min - 1))}>−</button>
            <span className="b" style={{ fontSize: 22 }}>{min}</span>
            <button onClick={() => setMin(min + 1)}>+</button>
            <span className="muted small">{own} oprócz Ciebie</span>
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>Teraz idzie: {sameGenderGoing} {own}</div>
        </div>
      )}
      {existing && <div className="sec"><ConditionLine view={view} pid={me.id} oid={oid} day={day} /></div>}
      <div className="sec" style={{ display: 'grid', gap: 8 }}>
        <button className="btn" disabled={mode === 'people' && !people.length} onClick={() => save(mode === 'people' ? { kind: 'people', people } : { kind: 'min', min })}>Zapisz warunek</button>
        {existing && <button className="btn ghost" onClick={() => save(null)}>Bez warunku</button>}
      </div>
    </Sheet>
  )
}
