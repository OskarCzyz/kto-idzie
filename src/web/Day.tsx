// One camp day, step by step: "Na co chcesz iść?" → "Idziesz niezależnie od innych?" → "A gdyby nie wyszło?",
// then a summary of my plans (A, B, C… = the ranking, highest first).
import { useState, type ReactNode } from 'react'
import { addPick, isMentor, keepOnAllDays, openGroups, movePick, removePick, setDayStatus, setMentorRole, type MentorRole, type Plan } from '../domain'
import { Coach } from './Coach'
import { GoingWith } from './parts'
import { CATEGORIES, type OfferingDto } from '../shared/api'
import { Thumb, useChoice, type Choose } from './ui'
import { GROUP_LABEL, capacityText, eligibilityText, g, planLetter, planState, type View } from './view'

export interface DayProps {
  view: View
  day: number
  edit: (change: (plan: Plan) => Plan) => void
  openOffering: (oid: number) => void
  openCondition: (oid: number) => void
}

const TONE = { ok: 'var(--ok)', wait: 'var(--wait)', muted: 'var(--muted)' }

type Sort = 'popular' | 'category' | 'needMentor'
const SORT_KEY = 'day-sort'

/** Remembered per browser; falls back to "popular" when storage is unavailable. "needMentor" is for mentors only. */
function useSort(mentor: boolean): [Sort, (s: Sort) => void] {
  const [sort, setSort] = useState<Sort>(() => {
    try {
      const s = localStorage.getItem(SORT_KEY)
      return s === 'category' || (s === 'needMentor' && mentor) ? s : 'popular'
    } catch {
      return 'popular'
    }
  })
  const set = (s: Sort) => {
    setSort(s)
    try {
      localStorage.setItem(SORT_KEY, s)
    } catch {}
  }
  return [sort, set]
}

type Step = { kind: 'pick' } | { kind: 'role'; oid: number } | { kind: 'who'; oid: number } | null

const COACH = [
  { target: 'question', text: 'Odpowiadasz na proste pytania: na co chcesz iść, z kim i co, gdyby nie wyszło.' },
  { target: 'question', text: 'Plan B jest tylko na wypadek, gdyby Plan A nie wyszedł (np. nie idą Twoi znajomi). Nie musisz go mieć.' },
]

/** Adds a plan. A multi-day activity that collides with plans I already have is asked about right away. False if cancelled. */
async function addPlan(view: View, oid: number, edit: DayProps['edit'], choose: Choose): Promise<boolean> {
  const o = view.domainOffering(oid)
  const name = view.activityOf(oid).name
  const busy = o.days.filter((d) => (view.myPlan.rankings[d] ?? []).length > 0)
  if (o.days.length < 2 || !busy.length) {
    edit((p) => addPick(p, o))
    return true
  }
  const have = busy.map((d) => `dzień ${view.dayNo(d)} – ${view.activityOf(view.myPlan.rankings[d]![0]!).name}`).join(', ')
  const i = await choose(`${name} trwa ${view.daysText(view.offering(oid))}. Na te dni masz już: ${have}.`, [
    `${name} jako Plan A we wszystkie te dni`,
    'Tylko jako plan zapasowy',
    'Anuluj',
  ])
  if (i === 0) edit((p) => keepOnAllDays(addPick(p, o), o))
  if (i === 1) edit((p) => addPick(p, o))
  return i === 0 || i === 1
}

export function Day({ view, day, edit, openOffering, openCondition }: DayProps) {
  const [choiceSheet, choose] = useChoice()
  const [step, setStep] = useState<Step>(null)
  const [sort, setSort] = useSort(isMentor(view.me))
  const me = view.me.id
  const ranking = view.myPlan.rankings[day] ?? []
  const options = view
    .offeringsOn(day)
    .filter((o) => view.eligibleForMe(o) && !ranking.includes(o.id))
    .sort((a, b) => view.goers(b.id, day).length - view.goers(a.id, day).length)
  const active: Step = step ?? (ranking.length ? null : { kind: 'pick' })
  const mentor = isMentor(view.me)
  const needMentor = options
    .filter((o) => view.mentorGap(o.id, day).missing > 0)
    .sort((a, b) => view.mentorGap(b.id, day).missing - view.mentorGap(a.id, day).missing)
  const bothRoles = (oid: number) => openGroups(view.me, view.domainOffering(oid)).length === 2
  const setRole = (oid: number, role: MentorRole) => edit((p) => setMentorRole(p, oid, role))

  const frame = (content: ReactNode) => (
    <>
      {content}
      {choiceSheet}
      <Coach id="day" steps={COACH} />
    </>
  )

  if (active?.kind === 'role') {
    const a = view.activityOf(active.oid)
    const pick = (role: MentorRole) => {
      setRole(active.oid, role)
      setStep({ kind: 'who', oid: active.oid })
    }
    return frame(
      <div className="qbox" data-coach="question">
        <Thumb activity={a} size={72} />
        <div className="qbig">{a.name} – bierzesz udział jako mentor?</div>
        <div className="small muted">Każda grupa ma w aplikacji „Event” osobny limit miejsc.</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 14, width: '100%' }}>
          <button className="btn" onClick={() => pick('in')}>Tak – mentor uczestniczący</button>
          <button className="btn ghost" onClick={() => pick('out')}>Nie – mentor nieuczestniczący</button>
        </div>
      </div>,
    )
  }

  if (active?.kind === 'who') {
    const a = view.activityOf(active.oid)
    return frame(
      <div className="qbox" data-coach="question">
        <Thumb activity={a} size={72} />
        <div className="qbig">{a.name} – idziesz niezależnie od innych?</div>
        <GoingWith view={view} oid={active.oid} day={day} />
        <div style={{ display: 'grid', gap: 8, marginTop: 14, width: '100%' }}>
          <button className="btn" onClick={() => setStep(null)}>Tak, idę</button>
          <button className="btn ghost" onClick={() => { openCondition(active.oid); setStep(null) }}>Jeśli idzie…</button>
        </div>
      </div>,
    )
  }

  if (active?.kind === 'pick') {
    const prev = ranking.length ? view.activityOf(ranking[ranking.length - 1]!).name : null
    return frame(
      <>
        <div className="qbox" data-coach="question">
          <div className="small muted">Dzień {view.dayNo(day)}{prev && ` · Plan ${planLetter(ranking.length)}`}</div>
          <div className="qbig">{prev ? `A gdyby ${prev} nie wyszło?` : 'Na co chcesz iść?'}</div>
        </div>
        {options.length > 1 && (
          <div className="chips">
            <button className={`chip ${sort === 'popular' ? 'on' : ''}`} onClick={() => setSort('popular')}>Najpopularniejsze</button>
            <button className={`chip ${sort === 'category' ? 'on' : ''}`} onClick={() => setSort('category')}>Według kategorii</button>
            {mentor && <button className={`chip ${sort === 'needMentor' ? 'on' : ''}`} onClick={() => setSort('needMentor')}>Mentee bez mentora</button>}
          </div>
        )}
        {sort === 'needMentor' && (
          <div className="small muted" style={{ textAlign: 'center', padding: '0 16px' }}>
            {needMentor.length ? 'Tu idą mentee, a mentorów jest mniej niż 1 na 3 osoby.' : 'Wszędzie, gdzie idą mentee, jest już co najmniej 1 mentor na 3 osoby.'}
          </div>
        )}
        {(sort === 'category' ? byCategory(view, options) : [{ name: null, items: sort === 'needMentor' ? needMentor : options }]).map(({ name, items }) => (
          <div key={name ?? 'all'}>
            {name && <div className="h3" style={{ margin: '14px 16px 0' }}>{name}</div>}
            <div className="tiles">
              {items.map((o) => (
                <button key={o.id} className="tile" onClick={async () => { if (await addPlan(view, o.id, edit, choose)) setStep({ kind: mentor && bothRoles(o.id) ? 'role' : 'who', oid: o.id }) }}>
                  <Thumb activity={view.activityOf(o.id)} size={64} />
                  <span className="b">{view.activityOf(o.id).name}</span>
                  <span className="small muted">{[view.daysText(o), eligibilityText(o), capacityText(o.capacity, openGroups(view.me, view.domainOffering(o.id))), o.highDemand ? '🔥' : ''].filter(Boolean).join(' · ')}</span>
                  <GoingWith view={view} oid={o.id} day={day} />
                  {sort === 'needMentor' && <MentorGap view={view} oid={o.id} day={day} />}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!options.length && <div className="card pad small muted">Nie ma więcej aktywności na ten dzień.</div>}
        {ranking.length > 0 && (
          <div className="pad">
            <button className="btn ghost" style={{ width: '100%' }} onClick={() => setStep(null)}>{prev ? 'Nie potrzebuję planu zapasowego' : 'Wróć'}</button>
          </div>
        )}
      </>,
    )
  }

  return frame(
    <>
      <NowCard view={view} day={day} edit={edit} />
      <Conflicts view={view} day={day} edit={edit} />
      <div className="h3" data-coach="question">Twoje plany na dzień {view.dayNo(day)}</div>
      {ranking.map((oid, i) => {
        const st = planState(view, day, oid)
        const a = view.activityOf(oid)
        return (
          <div key={oid}>
            {i > 0 && <div className="chain-arrow">↓ a jeśli nie wyjdzie</div>}
            <div className={`card pad plan-card ${st.tone === 'ok' ? 'on' : ''}`}>
              <div className="row" onClick={() => openOffering(oid)} style={{ cursor: 'pointer' }}>
                <span className={`letter ${st.tone === 'ok' ? 'on' : ''}`}>{planLetter(i)}</span>
                <Thumb activity={a} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="b">{a.name} {view.daysText(view.offering(oid)) && <span className="badge">{view.daysText(view.offering(oid))}</span>}</div>
                  {st.text && <div className="small" style={{ color: TONE[st.tone] }}>{st.text}</div>}
                </div>
              </div>
              {mentor && bothRoles(oid) && (
                <button className="linkb small" style={{ marginTop: 6 }} onClick={() => setRole(oid, view.groupOf(me, oid) === 'mentorOut' ? 'in' : 'out')}>
                  👤 {GROUP_LABEL[view.groupOf(me, oid)]} ⇄
                </button>
              )}
              {mentor && !bothRoles(oid) && <div className="small muted" style={{ marginTop: 6 }}>👤 {GROUP_LABEL[view.groupOf(me, oid)]} (jedyna możliwość)</div>}
              <div className="row small" style={{ marginTop: 8, gap: 14 }}>
                <button className="linkb" onClick={() => openCondition(oid)}>🤝 {view.myPlan.conditions[oid] ? 'zmień, z kim' : 'z kim?'}</button>
                {i > 0 && <button className="linkb" onClick={() => edit((p) => movePick(p, day, i, 0))}>zrób Planem A</button>}
                <span className="sp" />
                <button className="linkb danger" onClick={() => edit((p) => removePick(p, view.domainOffering(oid)))}>usuń</button>
              </div>
            </div>
          </div>
        )
      })}
      {options.length > 0 && (
        <div className="pad">
          <button className="btn ghost" style={{ width: '100%' }} onClick={() => setStep({ kind: 'pick' })}>+ Plan {planLetter(ranking.length)} – gdyby nie wyszło</button>
        </div>
      )}
    </>,
  )
}

const mentorsWord = (n: number) =>
  n === 1 ? 'mentor' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'mentorzy' : 'mentorów'

function MentorGap({ view, oid, day }: { view: View; oid: number; day: number }) {
  const { mentees, mentors, missing } = view.mentorGap(oid, day)
  return (
    <span className="small" style={{ color: 'var(--wait)' }}>
      {mentees} mentee · {mentors} {mentorsWord(mentors)} · brakuje {missing}
    </span>
  )
}

/** Options grouped in the fixed category order, most popular first within a group; uncategorized last. */
function byCategory(view: View, options: OfferingDto[]): { name: string; items: OfferingDto[] }[] {
  const groups = [...CATEGORIES, null].map((c) => ({ name: c ?? 'Inne', items: options.filter((o) => view.activityOf(o.id).category === c) }))
  return groups.filter((g) => g.items.length)
}

function NowCard({ view, day, edit }: { view: View; day: number; edit: DayProps['edit'] }) {
  const me = view.me.id
  const current = view.res.currentChoice(me, day)
  const registered = view.status(me, day) === 'registered'
  // Registering is for what I'm going to now, so it becomes Plan A.
  const toggle = (cur: number) =>
    edit((p) => {
      if (registered) return setDayStatus(p, day, 'wondering', view.offerings)
      const i = (p.rankings[day] ?? []).indexOf(cur)
      return setDayStatus(i > 0 ? movePick(p, day, i, 0) : p, day, 'registered', view.offerings)
    })
  return (
    <div className="now">
      <div className="small muted">Dzień {view.dayNo(day)} · idziesz na:</div>
      {current != null ? (
        <>
          <div className="row" style={{ marginTop: 6 }}>
            <Thumb activity={view.activityOf(current)} />
            <div>
              <div className="b" style={{ fontSize: 18 }}>{view.activityOf(current).name}</div>
              <div className="small muted">z Tobą: {view.goers(current, day).length - 1} os.</div>
            </div>
          </div>
          <button className={`reg ${registered ? 'on' : ''}`} onClick={() => toggle(current)}>
            <span className="box">{registered ? '✓' : ''}</span>
            {g(view.me.gender, 'Zapisałem', 'Zapisałam')} się w aplikacji „Event”
          </button>
        </>
      ) : (
        <div className="b" style={{ marginTop: 4 }}>— żaden plan jeszcze nie wychodzi</div>
      )}
    </div>
  )
}

function Conflicts({ view, day, edit }: { view: View; day: number; edit: DayProps['edit'] }) {
  const me = view.me.id
  return view.res
    .conflicts(me)
    .filter((oid) => view.offering(oid).dayIds.includes(day))
    .map((oid) => {
      const o = view.offering(oid)
      const name = view.activityOf(oid).name
      const other = o.dayIds.map((d) => view.res.currentChoice(me, d)).find((c) => c != null && c !== oid)
      const otherName = other != null ? view.activityOf(other).name : null
      return (
        <div key={oid} className="warn">
          ⚠️ {name} trwa {view.daysText(o)}, a w jeden z tych dni wolisz {otherName ?? 'coś innego'}. Co wybierasz?
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={() => edit((p) => keepOnAllDays(p, view.domainOffering(oid)))}>{name}</button>
            <button className="btn sm ghost" onClick={() => edit((p) => removePick(p, view.domainOffering(oid)))}>{otherName ?? `Usuń ${name}`}</button>
          </div>
        </div>
      )
    })
}
