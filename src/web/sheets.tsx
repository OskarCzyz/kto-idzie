import { useState } from 'react'
import { setCondition, type Condition, type Plan } from '../domain'
import { Avatar, Sheet, Thumb } from './ui'
import { GROUP_LABEL, STATUS_ICON, eligibilityText, fullName, planLetter, statusLabel, toDomainOffering, type View } from './view'
import type { SignupGroup } from '../domain'

const GROUPS: SignupGroup[] = ['mentee', 'mentorIn', 'mentorOut']
import { eligible, isMentor } from '../domain'

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
        {a.category && <div className="small" style={{ color: 'var(--teal)' }}>{a.category}</div>}
        <div className="small muted">{o.dayIds.map((x) => `Dzień ${view.dayNo(x)}`).join(', ')}{eligibilityText(o) && ` · ${eligibilityText(o)}`}</div>
        {o.highDemand && <span className="badge hot">🔥 duże zainteresowanie</span>}
        <div className="groups">
          {GROUPS.map((k) => (
            <span key={k} className="badge">
              {GROUP_LABEL[k]}: {o.capacity[k] === 0 ? 'nie można się zapisać' : <>nas {goers.filter((p) => view.groupOf(p.id, oid) === k).length}{o.capacity[k] != null && ` / max ${o.capacity[k]}`}</>}
            </span>
          ))}
        </div>
      </div>
      <div className="sec">
        <div className="sec-title">Idą ({goers.length})</div>
        {(['registered', 'wondering'] as const).map((s) => {
          const g = goers.filter((p) => view.status(p.id, d) === s)
          if (!g.length) return null
          return (
            <div key={s}>
              <div className="small b" style={{ margin: '4px 0' }}>{s === 'registered' ? '🎟️ Zapisani' : '🤔 Jeszcze niezapisani'} · {g.length}</div>
              {g.map((p) => <span key={p.id} className="namechip" onClick={() => openPerson(p.id)}><Avatar person={p} size={20} me={p.id === view.me.id} />{p.id === view.me.id ? 'Ty' : p.firstName}</span>)}
            </div>
          )
        })}
        {!goers.length && <span className="muted">nikt</span>}
      </div>
      <div className="sec">
        <div className="sec-title">Mają jako plan zapasowy ({considering.length})</div>
        {considering.map((p) => (
          <span key={p.id} className="namechip" onClick={() => openPerson(p.id)}>
            <Avatar person={p} size={20} me={p.id === view.me.id} />{p.id === view.me.id ? 'Ty' : p.firstName} <span className="rk">{planLetter((view.planOf(p.id).rankings[d] ?? []).indexOf(oid))}</span>
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
            <div className="row"><b>Dzień {d.dayNo}</b><span className="sp" /><span className="small">{STATUS_ICON[s]} {statusLabel(s, p.gender)}</span></div>
            {ranking.length ? (
              ranking.map((oid, i) => (
                <div key={oid} className="small" style={{ marginTop: 4, fontWeight: oid === current ? 700 : 400, color: oid === current ? undefined : 'var(--muted)' }}>
                  {planLetter(i)}. {view.activityOf(oid).name}{isMentor(p) && ` (${GROUP_LABEL[view.groupOf(pid, oid)]})`}{oid === current && ' ← idzie'}
                  {view.conditionText(pid, oid) && <span style={{ color: 'var(--cond)' }}> · 🤝 {view.conditionText(pid, oid)}</span>}
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

/** "Pójdę, jeśli idzie też…": specific people; at least N of my gender is under "Więcej opcji". */
export function ConditionSheet({ view, oid, day, edit, onClose }: { view: View; oid: number; day: number; edit: (change: (plan: Plan) => Plan) => void; onClose: () => void }) {
  const existing = view.myPlan.conditions[oid]
  const [people, setPeople] = useState<number[]>(existing?.kind === 'people' ? existing.people : [])
  const [more, setMore] = useState(existing?.kind === 'min')
  const [min, setMin] = useState(existing?.kind === 'min' ? existing.min : 2)
  const [query, setQuery] = useState('')
  const o = view.offering(oid)
  const me = view.me
  const own = me.gender === 'K' ? 'dziewczyn' : 'chłopców'
  const going = (pid: number) => view.res.currentChoice(pid, day) === oid
  const candidates = view.state.people
    .filter((p) => p.id !== me.id && eligible(p, toDomainOffering(o)) && (!query || fullName(p).toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => Number(people.includes(b.id)) - Number(people.includes(a.id)) || Number(going(b.id)) - Number(going(a.id)))
  const toggle = (id: number) => setPeople((ps) => (ps.includes(id) ? ps.filter((x) => x !== id) : [...ps, id]))
  const sameGenderGoing = view.goers(oid, day).filter((p) => p.id !== me.id && p.gender === me.gender).length

  function save(c: Condition | null) {
    edit((p) => setCondition(p, oid, c))
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sec">
        <div className="b" style={{ fontSize: 18 }}>Pójdę na {view.activityOf(oid).name}, jeśli idzie też…</div>
        <div className="small muted" style={{ marginTop: 3 }}>Zaznacz osoby. Dopóki nie idą, ten plan czeka, a liczy się następny.</div>
      </div>
      <div className="sec">
        <input className="input" placeholder="Szukaj osoby…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {candidates.slice(0, 8).map((p) => (
          <button key={p.id} className="pi" onClick={() => toggle(p.id)}>
            <Avatar person={p} />
            <span>{fullName(p)}</span>
            <span className="sp" />
            <span className="small muted">{going(p.id) ? 'idzie' : ''}</span>
            <span>{people.includes(p.id) ? '☑️' : '⬜'}</span>
          </button>
        ))}
      </div>
      <div className="sec">
        <button className="linkb" onClick={() => setMore(!more)}>Więcej opcji {more ? '▴' : '▾'}</button>
        {more && (
          <div className="card pad" style={{ margin: '8px 0 0' }}>
            <div className="small muted">Zamiast konkretnych osób: pójdę, jeśli idzie co najmniej</div>
            <div className="stepper" style={{ marginTop: 6 }}>
              <button onClick={() => setMin(Math.max(1, min - 1))}>−</button>
              <span className="b" style={{ fontSize: 20 }}>{min}</span>
              <button onClick={() => setMin(min + 1)}>+</button>
              <span className="muted small">{own} oprócz Ciebie</span>
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>Teraz idzie: {sameGenderGoing} {own}</div>
            <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => save({ kind: 'min', min })}>Zapisz: min. {min} {own}</button>
          </div>
        )}
      </div>
      <div className="sec" style={{ display: 'grid', gap: 8 }}>
        <button className="btn" disabled={!people.length} onClick={() => save({ kind: 'people', people })}>Zapisz</button>
        <button className="btn ghost" onClick={() => save(null)}>Idę niezależnie od innych</button>
      </div>
    </Sheet>
  )
}
