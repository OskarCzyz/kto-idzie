// Pure, immutable editing operations on a participant's Plan.
import type { Condition, DayId, MentorRole, Offering, OfferingId, Participant, ParticipantId, Plan, StoredDayStatus } from './index'
import { eligible, isMentor, openGroups } from './index'

const withoutStatus = (statuses: Plan['statuses'], day: DayId) => {
  const { [day]: _, ...rest } = statuses
  return rest
}

/** Appends the offering to the ranking of every day it covers. */
export function addPick(plan: Plan, offering: Offering, condition?: Condition): Plan {
  const rankings = { ...plan.rankings }
  for (const d of offering.days) {
    const r = rankings[d] ?? []
    if (!r.includes(offering.id)) rankings[d] = [...r, offering.id]
  }
  const conditions = condition ? { ...plan.conditions, [offering.id]: condition } : plan.conditions
  return { ...plan, rankings, conditions }
}

export function removePick(plan: Plan, offering: Offering): Plan {
  const rankings = { ...plan.rankings }
  let statuses = plan.statuses
  for (const d of offering.days) {
    const before = rankings[d] ?? []
    rankings[d] = before.filter((x) => x !== offering.id)
    if (!rankings[d]!.length || before[0] === offering.id) statuses = withoutStatus(statuses, d)
  }
  const { [offering.id]: _, ...conditions } = plan.conditions
  const { [offering.id]: __, ...mentorRoles } = plan.mentorRoles
  return { ...plan, rankings, conditions, statuses, mentorRoles }
}

export function setMentorRole(plan: Plan, offeringId: OfferingId, role: MentorRole): Plan {
  return { ...plan, mentorRoles: { ...plan.mentorRoles, [offeringId]: role } }
}

/** Moves the pick at index `from` to index `to` in one day's ranking. A new #1 means wondering again. */
export function movePick(plan: Plan, day: DayId, from: number, to: number): Plan {
  const r = [...(plan.rankings[day] ?? [])]
  const [moved] = r.splice(from, 1)
  if (moved === undefined) return plan
  r.splice(to, 0, moved)
  const statuses = r[0] !== plan.rankings[day]?.[0] ? withoutStatus(plan.statuses, day) : plan.statuses
  return { ...plan, rankings: { ...plan.rankings, [day]: r }, statuses }
}

export function setCondition(plan: Plan, offeringId: OfferingId, condition: Condition | null): Plan {
  const { [offeringId]: _, ...rest } = plan.conditions
  return { ...plan, conditions: condition ? { ...rest, [offeringId]: condition } : rest }
}

/**
 * Wondering applies to one day. Registered applies to the day's #1 on every day it covers,
 * moving it to the top there too.
 */
export function setDayStatus(plan: Plan, day: DayId, status: StoredDayStatus, offerings: Offering[]): Plan {
  if (status === 'wondering') return { ...plan, statuses: withoutStatus(plan.statuses, day) }
  const top = plan.rankings[day]?.[0]
  const offering = offerings.find((o) => o.id === top)
  if (!offering) return plan
  const rankings = { ...plan.rankings }
  const statuses = { ...plan.statuses }
  for (const d of offering.days) {
    rankings[d] = [offering.id, ...(rankings[d] ?? []).filter((x) => x !== offering.id)]
    statuses[d] = status
  }
  return { ...plan, rankings, statuses }
}

/** Resolves a multi-day conflict in favour of the offering: #1 on all its days. */
export function keepOnAllDays(plan: Plan, offering: Offering): Plan {
  const rankings = { ...plan.rankings }
  let statuses = plan.statuses
  for (const d of offering.days) {
    const r = rankings[d] ?? []
    if (r[0] !== offering.id) statuses = withoutStatus(statuses, d)
    rankings[d] = [offering.id, ...r.filter((x) => x !== offering.id)]
  }
  return { ...plan, rankings, statuses }
}

/** Makes an untrusted plan consistent: only eligible offerings on days they cover, multi-day picks on all days, valid conditions. */
export function normalizePlan(plan: Plan, offerings: Offering[], me: Participant, participantIds: Set<ParticipantId>): Plan {
  const byId = new Map(offerings.map((o) => [o.id, o]))
  const days = [...new Set(offerings.flatMap((o) => o.days))].sort((a, b) => a - b)
  const rankings: Plan['rankings'] = {}
  for (const d of days) {
    rankings[d] = [...new Set(plan.rankings[d] ?? [])].filter((oid) => {
      const o = byId.get(oid)
      return !!o && o.days.includes(d) && eligible(me, o)
    })
  }
  const picked = new Set(Object.values(rankings).flat())
  for (const oid of picked) {
    for (const d of byId.get(oid)!.days) if (!rankings[d]!.includes(oid)) rankings[d]!.push(oid)
  }
  const conditions: Plan['conditions'] = {}
  for (const [key, c] of Object.entries(plan.conditions)) {
    const oid = Number(key)
    if (!picked.has(oid)) continue
    if (c.kind === 'min' && Number.isInteger(c.min) && c.min >= 1 && c.min <= 100) conditions[oid] = { kind: 'min', min: c.min }
    if (c.kind === 'people') {
      const people = [...new Set(c.people)].filter((p) => p !== me.id && participantIds.has(p))
      if (people.length) conditions[oid] = { kind: 'people', people }
    }
  }
  const statuses: Plan['statuses'] = {}
  for (const [key, s] of Object.entries(plan.statuses)) {
    const d = Number(key)
    if (rankings[d]?.length && (s === 'wondering' || s === 'registered')) statuses[d] = s
  }
  const mentorRoles: Plan['mentorRoles'] = {}
  if (isMentor(me)) {
    for (const oid of picked) {
      const asked = plan.mentorRoles?.[oid]
      const open = openGroups(me, byId.get(oid)!)
      // A role whose group is closed (capacity 0) switches to the other one.
      if (!open.includes('mentorIn')) mentorRoles[oid] = 'out'
      else if (asked === 'out' && open.includes('mentorOut')) mentorRoles[oid] = 'out'
      else if (asked === 'in') mentorRoles[oid] = 'in'
    }
  }
  return { participantId: me.id, rankings, conditions, statuses, mentorRoles }
}
