// Pure domain model, shared by the Worker and the SPA. Terms follow CONTEXT.md.

export type Gender = 'M' | 'K'
export type Bracket = 'U15' | 'U18' | 'O18'
export type DayId = number
export type OfferingId = number
export type ParticipantId = number

export interface Offering {
  id: OfferingId
  days: DayId[]
  gender: Gender | null
  brackets: Bracket[] | null
}

export interface Participant {
  id: ParticipantId
  gender: Gender
  bracket: Bracket
}

export type Condition =
  | { kind: 'people'; people: ParticipantId[] }
  | { kind: 'min'; min: number } // at least N others of the participant's own gender

export type DayStatus = 'undecided' | 'wondering' | 'decided' | 'registered'
export type StoredDayStatus = Exclude<DayStatus, 'undecided'>

export interface Plan {
  participantId: ParticipantId
  rankings: Record<DayId, OfferingId[]>
  conditions: Record<OfferingId, Condition>
  statuses: Record<DayId, StoredDayStatus>
}

export function eligible(p: Participant, o: Offering): boolean {
  return (!o.gender || o.gender === p.gender) && (!o.brackets || o.brackets.includes(p.bracket))
}

export function dayStatus(plan: Plan, day: DayId): DayStatus {
  if (!plan.rankings[day]?.length) return 'undecided'
  return plan.statuses[day] ?? 'wondering'
}

export interface Resolution {
  currentChoice(participant: ParticipantId, day: DayId): OfferingId | null
  /** Multi-day picks outranked on one of their days while they would otherwise win. */
  conflicts(participant: ParticipantId): OfferingId[]
  conditionMet(participant: ParticipantId, offering: OfferingId, day: DayId): boolean
}

type Choices = Map<ParticipantId, Map<DayId, OfferingId | null>>

const MAX_ROUNDS = 50

/**
 * Works out every participant's current choice per day.
 *
 * Start with everyone at their #1, then repeatedly move each participant to their highest pick whose
 * condition holds against the others' choices from the previous round, until nothing changes. Starting
 * optimistic is what makes mutual conditions end up met. A multi-day pick that doesn't win on all of its
 * days becomes a conflict and is skipped from then on. If the rounds don't settle (conditions can
 * oscillate), picks whose condition fails are dropped permanently until they do.
 */
export function resolve(input: { participants: Participant[]; offerings: Offering[]; plans: Plan[] }): Resolution {
  const offerings = new Map(input.offerings.map((o) => [o.id, o]))
  const participants = new Map(input.participants.map((p) => [p.id, p]))
  const plans = input.plans.filter((p) => participants.has(p.participantId))
  const days = [...new Set(input.offerings.flatMap((o) => o.days))]

  const conflicted = new Map<ParticipantId, Set<OfferingId>>(plans.map((p) => [p.participantId, new Set()]))
  const dropped = new Map<ParticipantId, Set<OfferingId>>(plans.map((p) => [p.participantId, new Set()]))

  const conditionHolds = (plan: Plan, oid: OfferingId, day: DayId, cur: Choices): boolean => {
    const c = plan.conditions[oid]
    if (!c) return true
    if (c.kind === 'people') return c.people.every((q) => cur.get(q)?.get(day) === oid)
    const gender = participants.get(plan.participantId)!.gender
    let n = 0
    for (const [q, choices] of cur) {
      if (q !== plan.participantId && participants.get(q)?.gender === gender && choices.get(day) === oid) n++
    }
    return n >= c.min
  }

  const step = (cur: Choices): Choices => {
    const next: Choices = new Map()
    for (const plan of plans) {
      const pid = plan.participantId
      const mine = new Map<DayId, OfferingId | null>()
      for (const day of days) {
        const ranking = plan.rankings[day] ?? []
        const status = dayStatus(plan, day)
        mine.set(
          day,
          status === 'decided' || status === 'registered'
            ? (ranking[0] ?? null)
            : (ranking.find(
                (oid) => !conflicted.get(pid)!.has(oid) && !dropped.get(pid)!.has(oid) && conditionHolds(plan, oid, day, cur),
              ) ?? null),
        )
      }
      for (const oid of new Set(mine.values())) {
        const o = oid == null ? undefined : offerings.get(oid)
        if (o && o.days.length > 1 && !o.days.every((d) => mine.get(d) === oid)) conflicted.get(pid)!.add(o.id)
      }
      next.set(pid, mine)
    }
    return next
  }

  const same = (a: Choices, b: Choices) =>
    [...a].every(([pid, m]) => [...m].every(([day, oid]) => b.get(pid)?.get(day) === oid))

  let cur: Choices = new Map(
    plans.map((p) => [p.participantId, new Map(days.map((d) => [d, p.rankings[d]?.[0] ?? null]))]),
  )
  let settled = false
  for (let i = 0; i < MAX_ROUNDS && !settled; i++) {
    const conflictsBefore = countAll(conflicted)
    const next = step(cur)
    settled = same(cur, next) && countAll(conflicted) === conflictsBefore
    cur = next
  }
  // Fallback for oscillating setups: drop failing picks for good. Terminates because `dropped` only grows
  // and, once nothing new is dropped, every remaining pick holds, so the next round repeats itself.
  while (!settled) {
    let droppedAny = false
    for (const plan of plans) {
      for (const day of days) {
        if (dayStatus(plan, day) !== 'wondering') continue
        for (const oid of plan.rankings[day] ?? []) {
          if (!dropped.get(plan.participantId)!.has(oid) && !conditionHolds(plan, oid, day, cur)) {
            dropped.get(plan.participantId)!.add(oid)
            droppedAny = true
          }
        }
      }
    }
    const next = step(cur)
    settled = !droppedAny && same(cur, next)
    cur = next
  }

  const final = cur
  const planOf = new Map(plans.map((p) => [p.participantId, p]))
  return {
    currentChoice: (pid, day) => final.get(pid)?.get(day) ?? null,
    conflicts: (pid) => {
      const plan = planOf.get(pid)
      if (!plan) return []
      return [...conflicted.get(pid)!].filter((oid) =>
        offerings.get(oid)!.days.some((day) => {
          const ranking = plan.rankings[day] ?? []
          const choice = final.get(pid)?.get(day) ?? null
          return choice == null || ranking.indexOf(oid) < ranking.indexOf(choice)
        }),
      )
    },
    conditionMet: (pid, oid, day) => {
      const plan = planOf.get(pid)
      return plan ? conditionHolds(plan, oid, day, final) : false
    },
  }
}

function countAll(m: Map<unknown, Set<unknown>>): number {
  let n = 0
  for (const s of m.values()) n += s.size
  return n
}
