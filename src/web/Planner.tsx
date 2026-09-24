import { useMemo, useState } from 'react'
import type { Plan } from '../domain'
import type { Me } from '../shared/api'
import { Day } from './Day'
import { ConditionSheet, OfferingSheet, PersonSheet } from './sheets'
import { Summary } from './Summary'
import { confirmAsync } from './telegram'
import { useCampState } from './useCampState'
import { STATUS_ICON, daysUntil, makeView } from './view'

type SheetState = { type: 'offering'; oid: number } | { type: 'person'; pid: number } | { type: 'condition'; oid: number } | null

export function Planner({ me, onAdmin }: { me: Me; onAdmin?: () => void }) {
  const { state, savePlan, saveError } = useCampState(me.id)
  const [step, setStep] = useState(0)
  const [sheet, setSheet] = useState<SheetState>(null)
  const view = useMemo(() => (state && state.people.some((p) => p.id === me.id) ? makeView(state, me.id) : null), [state, me.id])

  if (state === undefined) return <div className="center muted">Ładowanie…</div>
  if (state === null || !view)
    return (
      <div className="center">
        <div>
          <p>Organizator jeszcze nie przygotował obozu.</p>
          {onAdmin && <button className="btn" onClick={onAdmin}>⚙️ Panel organizatora</button>}
        </div>
      </div>
    )

  const days = view.state.camp.days
  const dayId = days[step]?.id
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

  const goTo = (i: number) => {
    setStep(i)
    window.scrollTo(0, 0)
  }

  return (
    <div className="page">
      <div className="topbar row">
        <b className="ellipsis">{view.state.camp.name}</b>
        <span className="sp" />
        {toWave != null && <span className="wave">⏰ {toWave > 0 ? `${toWave} dni do zapisów` : toWave === 0 ? 'zapisy dziś!' : 'zapisy trwają'}</span>}
        {onAdmin && <button className="chip" onClick={onAdmin} aria-label="Panel organizatora">⚙️</button>}
      </div>
      <div className="steps">
        {days.map((d, i) => {
          const s = view.status(me.id, d.id)
          const conflict = view.res.conflicts(me.id).some((oid) => view.offering(oid).dayIds.includes(d.id))
          return (
            <button key={d.id} className={i === step ? 'on' : ''} onClick={() => goTo(i)}>
              {d.dayNo}
              <span className="dot">{conflict ? '⚠️' : s === 'undecided' ? '' : STATUS_ICON[s]}</span>
            </button>
          )
        })}
        <button className={step === days.length ? 'on' : ''} onClick={() => goTo(days.length)} aria-label="Podsumowanie">🗒️</button>
      </div>

      {dayId != null ? (
        <Day
          view={view}
          day={dayId}
          edit={edit}
          openOffering={(oid) => setSheet({ type: 'offering', oid })}
          openPerson={(pid) => setSheet({ type: 'person', pid })}
          openCondition={(oid) => setSheet({ type: 'condition', oid })}
        />
      ) : (
        <Summary view={view} goToDay={goTo} />
      )}

      <div className="bar">
        <button className="btn ghost" style={{ visibility: step === 0 ? 'hidden' : undefined }} onClick={() => goTo(step - 1)}>← Wstecz</button>
        <button className="btn" style={{ visibility: step === days.length ? 'hidden' : undefined }} onClick={() => goTo(step + 1)}>
          {step === days.length - 1 ? 'Podsumowanie →' : 'Dalej →'}
        </button>
      </div>

      {sheet?.type === 'offering' && <OfferingSheet view={view} oid={sheet.oid} day={dayId ?? view.offering(sheet.oid).dayIds[0]!} onClose={() => setSheet(null)} openPerson={(pid) => setSheet({ type: 'person', pid })} />}
      {sheet?.type === 'person' && <PersonSheet view={view} pid={sheet.pid} onClose={() => setSheet(null)} />}
      {sheet?.type === 'condition' && <ConditionSheet view={view} oid={sheet.oid} day={dayId ?? view.offering(sheet.oid).dayIds[0]!} edit={edit} onClose={() => setSheet(null)} />}
      {saveError && <div className="toast">{saveError}</div>}
    </div>
  )
}
