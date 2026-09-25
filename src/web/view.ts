// Read model for the planner: the camp state plus the resolved current choices, with lookup helpers.
import { closedGroups, dayStatus, eligible, resolve, signupGroup, type DayStatus, type Gender, type Offering, type Plan, type SignupGroup } from '../domain'
import type { Activity, CampState, OfferingDto, PersonDto } from '../shared/api'

export type Filter = 'all' | 'M' | 'K' | 'mine'

export const toDomainOffering = (o: OfferingDto): Offering => ({ id: o.id, days: o.dayIds, gender: o.gender, closed: closedGroups(o.capacity) })

export const STATUS_ICON: Record<DayStatus, string> = { undecided: '·', wondering: '🤔', registered: '🎟️' }
const STATUS_LABEL: Record<DayStatus, string> = { undecided: 'Brak planu', wondering: 'Jeszcze niezapisany', registered: 'Zapisany' }
const STATUS_LABEL_K: Record<DayStatus, string> = { ...STATUS_LABEL, wondering: 'Jeszcze niezapisana', registered: 'Zapisana' }

/** Status label in the person's grammatical gender (feminine for girls). */
export const statusLabel = (s: DayStatus, gender?: Gender | null) => (gender === 'K' ? STATUS_LABEL_K : STATUS_LABEL)[s]

export const GROUP_LABEL: Record<SignupGroup, string> = { mentee: 'mentee', mentorIn: 'mentor uczestniczący', mentorOut: 'mentor nieuczestniczący' }
const GROUP_SHORT: Record<SignupGroup, string> = { mentee: 'mentee', mentorIn: 'mentor ucz.', mentorOut: 'mentor nieucz.' }

/** "limit: mentee 20 · mentor ucz. 3" – only the groups that have a limit (optionally only `groups`). */
export function capacityText(c: OfferingDto['capacity'], groups = Object.keys(GROUP_SHORT) as SignupGroup[]): string {
  const parts = groups.filter((k) => c[k] != null).map((k) => `${GROUP_SHORT[k]} ${c[k]}`)
  return parts.length ? `limit: ${parts.join(' · ')}` : 'bez limitu'
}

/** Plan letter for a ranking position: 0 → A, 1 → B… */
export const planLetter = (i: number) => 'ABCDEFGH'[i] ?? String(i + 1)

/** Picks the masculine or feminine form for `gender`. */
export const g = (gender: Gender | null | undefined, m: string, k: string) => (gender === 'K' ? k : m)

export type View = ReturnType<typeof makeView>

export function makeView(state: CampState, meId: number) {
  const offerings = state.offerings.map(toDomainOffering)
  const participants = state.people.map((p) => ({ id: p.id, gender: p.gender, bracket: p.bracket }))
  const res = resolve({ participants, offerings, plans: state.plans })
  const people = new Map(state.people.map((p) => [p.id, p]))
  const plans = new Map(state.plans.map((p) => [p.participantId, p]))
  const activities = new Map(state.activities.map((a) => [a.id, a]))
  const offeringDtos = new Map(state.offerings.map((o) => [o.id, o]))
  const domainOfferings = new Map(offerings.map((o) => [o.id, o]))
  const me = people.get(meId)!
  const emptyPlan: Plan = { participantId: meId, rankings: {}, conditions: {}, statuses: {}, mentorRoles: {} }

  const planOf = (pid: number): Plan => plans.get(pid) ?? { ...emptyPlan, participantId: pid }
  const matches = (p: PersonDto, f: Filter) => (f === 'all' ? true : f === 'mine' ? p.bracket === me.bracket : p.gender === f)
  const status = (pid: number, day: number) => dayStatus(planOf(pid), day)

  return {
    state,
    res,
    me,
    myPlan: planOf(meId),
    offerings,
    person: (id: number) => people.get(id),
    planOf,
    status,
    offering: (id: number) => offeringDtos.get(id)!,
    domainOffering: (id: number) => domainOfferings.get(id)!,
    activityOf: (offeringId: number): Activity => activities.get(offeringDtos.get(offeringId)!.activityId)!,
    eligibleForMe: (o: OfferingDto) => eligible(me, toDomainOffering(o)),
    offeringsOn: (day: number) => state.offerings.filter((o) => o.dayIds.includes(day)),
    /** People for whom this offering is their current choice on `day`, registered first. */
    goers(oid: number, day: number, f: Filter = 'all') {
      const order: Record<DayStatus, number> = { registered: 0, wondering: 1, undecided: 2 }
      return state.people
        .filter((p) => res.currentChoice(p.id, day) === oid && matches(p, f))
        .sort((a, b) => order[status(a.id, day)] - order[status(b.id, day)])
    },
    /** People who have it in their ranking on `day` but not as their current choice. */
    considering(oid: number, day: number, f: Filter = 'all') {
      return state.people.filter((p) => res.currentChoice(p.id, day) !== oid && (planOf(p.id).rankings[day] ?? []).includes(oid) && matches(p, f))
    },
    undecided: (day: number, f: Filter = 'all') => state.people.filter((p) => status(p.id, day) === 'undecided' && matches(p, f)),
    matches,
    daysText(o: OfferingDto) {
      if (o.dayIds.length === state.camp.days.length && o.dayIds.length > 1) return 'cały obóz'
      if (o.dayIds.length < 2) return ''
      const nos = o.dayIds.map((d) => state.camp.days.find((x) => x.id === d)?.dayNo ?? '?')
      return `dni ${nos.join(', ')}`
    },
    /** The signup group this person would register in for the offering. */
    groupOf(pid: number, oid: number): SignupGroup {
      const g = signupGroup(people.get(pid) ?? { bracket: 'U18' }, planOf(pid), oid)
      // Until the server normalizes the plan, a closed mentor role means the other one.
      if (!domainOfferings.get(oid)?.closed.includes(g) || g === 'mentee') return g
      return g === 'mentorIn' ? 'mentorOut' : 'mentorIn'
    },
    /** Mentees and mentors going on `day`, and how many mentors are missing for 1 per 3 mentees. */
    mentorGap(oid: number, day: number) {
      const goers = state.people.filter((p) => res.currentChoice(p.id, day) === oid)
      const mentors = goers.filter((p) => p.bracket === 'O18').length
      const mentees = goers.length - mentors
      return { mentees, mentors, missing: Math.max(0, Math.ceil(mentees / 3) - mentors) }
    },
    dayNo: (dayId: number) => state.camp.days.find((d) => d.id === dayId)?.dayNo ?? 0,
    /** "jeśli idzie Tomek i Ola" / "jeśli idzie min. 3 chłopców" */
    conditionText(pid: number, oid: number): string | null {
      const c = planOf(pid).conditions[oid]
      if (!c) return null
      if (c.kind === 'min') return `jeśli idzie min. ${c.min} ${people.get(pid)?.gender === 'K' ? 'dziewczyn' : 'chłopców'}`
      return 'jeśli idzie ' + c.people.map((q) => (q === meId ? 'Ty' : (people.get(q)?.firstName ?? '?'))).join(' i ')
    },
  }
}

/** Short state of one of my plans on a day: going, waiting for its condition, in conflict, or a backup. */
export function planState(view: View, day: number, oid: number): { text: string; tone: 'ok' | 'wait' | 'muted' } {
  const me = view.me.id
  const current = view.res.currentChoice(me, day)
  const ranking = view.myPlan.rankings[day] ?? []
  const cond = view.conditionText(me, oid)
  if (current === oid) return { text: cond ? `✓ idziesz (${cond.replace('jeśli ', '')} ✓)` : '✓ idziesz', tone: 'ok' }
  if (cond && !view.res.conditionMet(me, oid, day)) return { text: `⏳ czeka – ${cond}`, tone: 'wait' }
  if (view.res.conflicts(me).includes(oid)) return { text: '⚠️ koliduje z innym dniem', tone: 'wait' }
  if (current != null && ranking.indexOf(current) < ranking.indexOf(oid)) return { text: 'zapasowy – na razie niepotrzebny', tone: 'muted' }
  return { text: '', tone: 'muted' }
}

export const eligibilityText = (o: OfferingDto) =>
  o.gender === 'K' ? 'tylko dziewczyny' : o.gender === 'M' ? 'tylko chłopcy' : ''

export const fullName = (p: PersonDto) => [p.firstName, p.lastName].filter(Boolean).join(' ')

const shortPl = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric' })

/** Header text for a bracket's registration wave: countdown, open (until…), or closed. */
export function waveStatus(opens: string | undefined, closes: string | undefined, bracket: string): string | null {
  const toOpen = daysUntil(opens)
  if (toOpen == null) return null
  if (toOpen > 0) return `${toOpen} dni do zapisów ${bracket}`
  const toClose = daysUntil(closes)
  if (toClose != null && toClose < 0) return `zapisy ${bracket} zakończone`
  const until = closes ? ` · do ${shortPl(closes)}` : ''
  return toOpen === 0 ? `zapisy ${bracket} od dziś${until}` : `zapisy ${bracket} trwają${until}`
}

export const waveRange = (opens: string | undefined, closes: string | undefined) =>
  opens ? `${shortPl(opens)}${closes ? ` – ${shortPl(closes)}` : ''}` : '—'

export function daysUntil(isoDate: string | undefined): number | null {
  if (!isoDate) return null
  const start = new Date(new Date().toDateString())
  return Math.round((new Date(isoDate + 'T00:00:00').getTime() - start.getTime()) / 864e5)
}
