import { Thumb } from './ui'
import type { Bracket } from '../domain'
import { STATUS_ICON, planLetter, statusLabel, waveRange, type View } from './view'

export function Summary({ view, goToDay }: { view: View; goToDay: (index: number) => void }) {
  const me = view.me.id
  const conflicts = view.res.conflicts(me)
  return (
    <>
      <h2 className="q" style={{ paddingTop: 14 }}>Twój plan</h2>
      <div className="card pad">
        <div className="small muted" style={{ marginBottom: 6 }}>Zapisy w aplikacji „Event”</div>
        {(['U15', 'U18', 'O18'] as Bracket[]).map((b) => (
          <div key={b} className="row small" style={{ padding: '3px 0', fontWeight: b === view.me.bracket ? 700 : 400 }}>
            <span style={{ width: 40 }}>{b}</span>
            <span>{waveRange(view.state.camp.waves[b], view.state.camp.waveEnds[b])}</span>
            {b === view.me.bracket && <span className="muted">· Twoja grupa</span>}
          </div>
        ))}
      </div>
      {conflicts.length > 0 && (
        <div className="warn">⚠️ Masz konflikt: {conflicts.map((oid) => view.activityOf(oid).name).join(', ')} – otwórz dzień, żeby go rozwiązać.</div>
      )}
      {view.state.camp.days.map((d, i) => {
        const current = view.res.currentChoice(me, d.id)
        const ranking = view.myPlan.rankings[d.id] ?? []
        const s = view.status(me, d.id)
        return (
          <div key={d.id} className="card pad" onClick={() => goToDay(i)} style={{ cursor: 'pointer' }}>
            <div className="row">
              <span className="small muted">Dzień {d.dayNo}</span>
              <span className="sp" />
              <span className="small">{STATUS_ICON[s]} {statusLabel(s, view.me.gender)}</span>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              {current != null ? <Thumb activity={view.activityOf(current)} size={36} /> : <span className="thumb" style={{ width: 36, height: 36 }}>❔</span>}
              <div>
                <div className="b">{current != null ? view.activityOf(current).name : ranking.length ? 'żaden plan jeszcze nie wychodzi' : 'nie wybrano'}</div>
                {current != null && <div className="small muted">z Tobą: {view.goers(current, d.id).length - 1} os.</div>}
              </div>
            </div>
            {(ranking.length > 1 || (ranking.length > 0 && ranking[0] !== current)) && (
              <div className="small muted" style={{ marginTop: 6 }}>
                Plany: {ranking.map((oid, j) => `${planLetter(j)}. ${view.activityOf(oid).name}${view.myPlan.conditions[oid] ? ' 🤝' : ''}`).join(' · ')}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
