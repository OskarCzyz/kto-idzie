// Read model for the planner: the camp state plus the resolved current choices, with lookup helpers.
import { dayStatus, eligible, resolve, type DayStatus, type Offering, type Plan } from '../domain'
import type { Activity, CampState, OfferingDto, PersonDto } from '../shared/api'

export type Filter = 'all' | 'M' | 'K' | 'mine'

export const toDomainOffering = (o: OfferingDto): Offering => ({ id: o.id, days: o.dayIds, gender: o.gender, brackets: o.brackets })

export const STATUS_ICON: Record<DayStatus, string> = { undecided: '·', wondering: '🤔', decided: '✅', registered: '🎟️' }
export const STATUS_LABEL: Record<DayStatus, string> = { undecided: 'Brak', wondering: 'Zastanawiam się', decided: 'Zdecydowany', registered: 'Zapisany' }

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
  const emptyPlan: Plan = { participantId: meId, rankings: {}, conditions: {}, statuses: {} }

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
      const order: Record<DayStatus, number> = { registered: 0, decided: 1, wondering: 2, undecided: 3 }
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
    dayNo: (dayId: number) => state.camp.days.find((d) => d.id === dayId)?.dayNo ?? 0,
  }
}

export const eligibilityText = (o: OfferingDto) =>
  [o.gender === 'K' ? 'tylko dziewczyny' : o.gender === 'M' ? 'tylko chłopcy' : '', o.brackets?.join('/') ?? ''].filter(Boolean).join(' · ')

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
