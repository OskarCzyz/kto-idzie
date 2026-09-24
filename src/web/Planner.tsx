import { useMemo, useState } from 'react'
import type { Plan } from '../domain'
import type { Me } from '../shared/api'
import { Day } from './Day'
import { Hero } from './Hero'
import { CalendarIcon, PeopleIcon, PlanIcon } from './icons'
import { People } from './People'
import { ConditionSheet, OfferingSheet, PersonSheet } from './sheets'
import { Summary } from './Summary'
import { confirmAsync } from './telegram'
import { useCampState } from './useCampState'
import { STATUS_ICON, daysUntil, makeView } from './view'

type Tab = 'days' | 'plan' | 'people'
type SheetState = { type: 'offering'; oid: number } | { type: 'person'; pid: number } | { type: 'condition'; oid: number } | null

export function Planner({ me, onAdmin }: { me: Me; onAdmin?: () => void }) {
  const { state, savePlan, saveError } = useCampState(me.id)
  const [tab, setTab] = useState<Tab>('days')
  const [dayIndex, setDayIndex] = useState(0)
  const [sheet, setSheet] = useState<SheetState>(null)
  const view = useMemo(() => (state && state.people.some((p) => p.id === me.id) ? makeView(state, me.id) : null), [state, me.id])

  if (state === undefined) return <div className="center muted">Ładowanie…</div>
  if (state === null || !view)
    return (
      <div className="page">
        <Hero />
        <div className="center">
          <div>
            <p>Organizator jeszcze nie przygotował obozu.</p>
            {onAdmin && <button className="btn" onClick={onAdmin}>⚙️ Panel organizatora</button>}
          </div>
        </div>
      </div>
    )

  const days = view.state.camp.days
  const day = days[Math.min(dayIndex, days.length - 1)]!
  const toWave = daysUntil(view.state.camp.waves[view.me.bracket])

  /** Applies a change to my plan; asks first if it would undo a Registered day. */
  async function edit(change: (plan: Plan) => Plan) {
    const before = view!.myPlan
    const next = change(before)
    const undoesRegistered = days.some(
      (d) => before.statuses[d.id] === 'registered' && (next.statuses[d.id] !== 'registered' || next.rankings[d.id]?.[0] !== before.rankings[d.id]?.[0]),
    )
    if (undoesRegistered && !(await confirmAsync('Na ten dzień jesteś oznaczony jako ZAPISANY. Na pewno zmienić?'))) return
    void savePlan(next)
  }

  const go = (t: Tab, index?: number) => {
    setTab(t)
    if (index !== undefined) setDayIndex(index)
    window.scrollTo(0, 0)
  }
  const shortDate = (date: string | null) =>
    date ? new Date(date + 'T00:00:00').toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric' }) : ''

  return (
    <div className="page with-nav">
      <Hero>
        {toWave != null && <span className="wave">⏰ {toWave > 0 ? `${toWave} dni do zapisów ${view.me.bracket}` : toWave === 0 ? 'zapisy dziś!' : 'zapisy trwają'}</span>}
        {onAdmin && <button className="chip" onClick={onAdmin} aria-label="Panel organizatora">⚙️</button>}
      </Hero>

      {tab === 'days' && (
        <>
          <nav className="daytabs">
            {days.map((d, i) => {
              const s = view.status(me.id, d.id)
              const conflict = view.res.conflicts(me.id).some((oid) => view.offering(oid).dayIds.includes(d.id))
              return (
                <button key={d.id} className={d.id === day.id ? 'on' : ''} onClick={() => go('days', i)}>
                  <span className="dn">Dzień {d.dayNo} {conflict ? '⚠️' : s === 'undecided' ? '' : STATUS_ICON[s]}</span>
                  <span className="ds">{shortDate(d.date)}</span>
                </button>
              )
            })}
          </nav>
          <Day
            key={day.id}
            view={view}
            day={day.id}
            edit={edit}
            openOffering={(oid) => setSheet({ type: 'offering', oid })}
            openPerson={(pid) => setSheet({ type: 'person', pid })}
            openCondition={(oid) => setSheet({ type: 'condition', oid })}
          />
        </>
      )}
      {tab === 'plan' && <Summary view={view} goToDay={(i) => go('days', i)} />}
      {tab === 'people' && <People view={view} openPerson={(pid) => setSheet({ type: 'person', pid })} />}

      <nav className="bottomnav">
        {([['days', <CalendarIcon key="c" />, 'Dni'], ['plan', <PlanIcon key="p" />, 'Mój plan'], ['people', <PeopleIcon key="u" />, 'Ludzie']] as const).map(([t, icon, label]) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => go(t)}>
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {sheet?.type === 'offering' && <OfferingSheet view={view} oid={sheet.oid} day={day.id} onClose={() => setSheet(null)} openPerson={(pid) => setSheet({ type: 'person', pid })} />}
      {sheet?.type === 'person' && <PersonSheet view={view} pid={sheet.pid} onClose={() => setSheet(null)} />}
      {sheet?.type === 'condition' && <ConditionSheet view={view} oid={sheet.oid} day={view.offering(sheet.oid).dayIds.includes(day.id) ? day.id : view.offering(sheet.oid).dayIds[0]!} edit={edit} onClose={() => setSheet(null)} />}
      {saveError && <div className="toast">{saveError}</div>}
    </div>
  )
}
