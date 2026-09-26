import { describe, expect, it } from 'vitest'
import { dayStatus, eligible, resolve, signupGroup, type Offering, type Participant, type Plan } from './index'

const boy = (id: number): Participant => ({ id, gender: 'M', bracket: 'U18' })
const girl = (id: number): Participant => ({ id, gender: 'K', bracket: 'U18' })
const single = (id: number, day: number, extra: Partial<Offering> = {}): Offering => ({
  id, days: [day], gender: null, closed: [], ...extra,
})

function plan(participantId: number, p: Partial<Omit<Plan, 'participantId'>> = {}): Plan {
  return { participantId, rankings: {}, conditions: {}, statuses: {}, mentorRoles: {}, ...p }
}

const KAYAK = 10, CLIMB = 11, ARCHERY = 12, THEATRE = 20

describe('eligible', () => {
  it('respects the gender restriction; every bracket can pick', () => {
    const girlsOnly = single(1, 1, { gender: 'K' })
    expect(eligible(girl(1), girlsOnly)).toBe(true)
    expect(eligible(boy(2), girlsOnly)).toBe(false)
    expect(eligible({ id: 3, gender: 'M', bracket: 'U15' }, single(2, 1))).toBe(true)
  })

  it('a closed signup group (capacity 0) cannot pick; a mentor needs one open mentor group', () => {
    const noMentees = single(1, 1, { closed: ['mentee'] })
    const oneMentorRole = single(2, 1, { closed: ['mentorOut'] })
    const noMentors = single(3, 1, { closed: ['mentorIn', 'mentorOut'] })
    const mentor: Participant = { id: 3, gender: 'M', bracket: 'O18' }
    expect(eligible(boy(1), noMentees)).toBe(false)
    expect(eligible(mentor, noMentees)).toBe(true)
    expect(eligible(mentor, oneMentorRole)).toBe(true)
    expect(eligible(mentor, noMentors)).toBe(false)
    expect(eligible(boy(1), noMentors)).toBe(true)
  })
})

describe('signupGroup', () => {
  it('U15/U18 are mentees; O18 are mentors taking part unless they chose not to', () => {
    const o18 = { bracket: 'O18' as const }
    expect(signupGroup({ bracket: 'U15' }, plan(1, { mentorRoles: { [KAYAK]: 'out' } }), KAYAK)).toBe('mentee')
    expect(signupGroup(o18, plan(1), KAYAK)).toBe('mentorIn')
    expect(signupGroup(o18, plan(1, { mentorRoles: { [KAYAK]: 'out' } }), KAYAK)).toBe('mentorOut')
  })
})

describe('dayStatus', () => {
  it('is undecided with an empty ranking, wondering by default otherwise', () => {
    expect(dayStatus(plan(1), 1)).toBe('undecided')
    expect(dayStatus(plan(1, { rankings: { 1: [KAYAK] } }), 1)).toBe('wondering')
    expect(dayStatus(plan(1, { rankings: { 1: [KAYAK] }, statuses: { 1: 'registered' } }), 1)).toBe('registered')
  })

  it('an empty ranking is undecided even if a status was stored', () => {
    expect(dayStatus(plan(1, { rankings: { 1: [] }, statuses: { 1: 'registered' } }), 1)).toBe('undecided')
  })
})

describe('resolve', () => {
  const offerings = [single(KAYAK, 1), single(CLIMB, 1), single(ARCHERY, 1)]

  it('current choice is #1 when it has no condition', () => {
    const r = resolve({ participants: [boy(1)], offerings, plans: [plan(1, { rankings: { 1: [KAYAK, CLIMB] } })] })
    expect(r.currentChoice(1, 1)).toBe(KAYAK)
  })

  it('is null for an empty ranking or unknown participant', () => {
    const r = resolve({ participants: [boy(1)], offerings, plans: [plan(1)] })
    expect(r.currentChoice(1, 1)).toBeNull()
    expect(r.currentChoice(99, 1)).toBeNull()
  })

  it('falls through an unmet condition to the next pick', () => {
    const r = resolve({
      participants: [boy(1), boy(2)],
      offerings,
      plans: [
        plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { people: [2], min: null } } }),
        plan(2, { rankings: { 1: [ARCHERY] } }),
      ],
    })
    expect(r.currentChoice(1, 1)).toBe(KAYAK)
    expect(r.conditionMet(1, CLIMB, 1)).toBe(false)
  })

  it('a named-people condition is met when they all have it as current choice', () => {
    const r = resolve({
      participants: [boy(1), boy(2), boy(3)],
      offerings,
      plans: [
        plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { people: [2, 3], min: null } } }),
        plan(2, { rankings: { 1: [CLIMB] } }),
        plan(3, { rankings: { 1: [ARCHERY, CLIMB] } }), // considers climbing but it isn't his current choice
      ],
    })
    expect(r.currentChoice(1, 1)).toBe(KAYAK)
  })

  it('named people and "min N" together: both must hold', () => {
    const cond = { [CLIMB]: { people: [2], min: 2 } }
    const onlyTomek = resolve({
      participants: [boy(1), boy(2), boy(3)],
      offerings,
      plans: [plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: cond }), plan(2, { rankings: { 1: [CLIMB] } }), plan(3, { rankings: { 1: [ARCHERY] } })],
    })
    expect(onlyTomek.currentChoice(1, 1)).toBe(KAYAK) // Tomek goes, but only 1 boy

    const enoughButNoTomek = resolve({
      participants: [boy(1), boy(2), boy(3), boy(4)],
      offerings,
      plans: [plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: cond }), plan(2, { rankings: { 1: [ARCHERY] } }), plan(3, { rankings: { 1: [CLIMB] } }), plan(4, { rankings: { 1: [CLIMB] } })],
    })
    expect(enoughButNoTomek.currentChoice(1, 1)).toBe(KAYAK) // 2 boys, but not Tomek

    const both = resolve({
      participants: [boy(1), boy(2), boy(3)],
      offerings,
      plans: [plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: cond }), plan(2, { rankings: { 1: [CLIMB] } }), plan(3, { rankings: { 1: [CLIMB] } })],
    })
    expect(both.currentChoice(1, 1)).toBe(CLIMB)
  })

  it('"min N" counts only others of own gender, not the participant', () => {
    const plans = [
      plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { people: [], min: 2 } } }),
      plan(2, { rankings: { 1: [CLIMB] } }),
      plan(3, { rankings: { 1: [CLIMB] } }), // girl – doesn't count for a boy
    ]
    const withOneBoy = resolve({ participants: [boy(1), boy(2), girl(3)], offerings, plans })
    expect(withOneBoy.currentChoice(1, 1)).toBe(KAYAK)

    const withTwoBoys = resolve({
      participants: [boy(1), boy(2), girl(3), boy(4)],
      offerings,
      plans: [...plans, plan(4, { rankings: { 1: [CLIMB] } })],
    })
    expect(withTwoBoys.currentChoice(1, 1)).toBe(CLIMB)
  })

  it('mutual conditions are both met ("going together")', () => {
    const r = resolve({
      participants: [boy(1), boy(2)],
      offerings,
      plans: [
        plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { people: [2], min: null } } }),
        plan(2, { rankings: { 1: [CLIMB, ARCHERY] }, conditions: { [CLIMB]: { people: [1], min: null } } }),
      ],
    })
    expect(r.currentChoice(1, 1)).toBe(CLIMB)
    expect(r.currentChoice(2, 1)).toBe(CLIMB)
  })

  it('a chain of three conditions resolves', () => {
    // 1 goes if 2 goes, 2 goes if 3 goes, 3 goes unconditionally
    const r = resolve({
      participants: [boy(1), boy(2), boy(3)],
      offerings,
      plans: [
        plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { people: [2], min: null } } }),
        plan(2, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { people: [3], min: null } } }),
        plan(3, { rankings: { 1: [CLIMB] } }),
      ],
    })
    expect([1, 2, 3].map((p) => r.currentChoice(p, 1))).toEqual([CLIMB, CLIMB, CLIMB])
  })

  it('a broken chain drops everyone above the break', () => {
    const r = resolve({
      participants: [boy(1), boy(2), boy(3)],
      offerings,
      plans: [
        plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { people: [2], min: null } } }),
        plan(2, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { people: [3], min: null } } }),
        plan(3, { rankings: { 1: [ARCHERY] } }),
      ],
    })
    expect([1, 2, 3].map((p) => r.currentChoice(p, 1))).toEqual([KAYAK, KAYAK, ARCHERY])
  })

  it('registered days take #1 and ignore its condition', () => {
    const r = resolve({
      participants: [boy(1)],
      offerings,
      plans: [plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { people: [], min: 5 } }, statuses: { 1: 'registered' } })],
    })
    expect(r.currentChoice(1, 1)).toBe(CLIMB)
  })

  describe('multi-day picks', () => {
    const theatre: Offering = { id: THEATRE, days: [1, 2], gender: null, closed: [] }
    const ms = [theatre, single(KAYAK, 1), single(CLIMB, 2)]

    it('is the current choice on all its days when it wins on all of them', () => {
      const r = resolve({ participants: [boy(1)], offerings: ms, plans: [plan(1, { rankings: { 1: [THEATRE, KAYAK], 2: [THEATRE, CLIMB] } })] })
      expect(r.currentChoice(1, 1)).toBe(THEATRE)
      expect(r.currentChoice(1, 2)).toBe(THEATRE)
      expect(r.conflicts(1)).toEqual([])
    })

    it('is a conflict and drops out when outranked on one of its days', () => {
      const r = resolve({ participants: [boy(1)], offerings: ms, plans: [plan(1, { rankings: { 1: [THEATRE, KAYAK], 2: [CLIMB, THEATRE] } })] })
      expect(r.conflicts(1)).toEqual([THEATRE])
      expect(r.currentChoice(1, 1)).toBe(KAYAK)
      expect(r.currentChoice(1, 2)).toBe(CLIMB)
    })

    it('is not reported as a conflict when it loses on every day anyway', () => {
      const r = resolve({ participants: [boy(1)], offerings: ms, plans: [plan(1, { rankings: { 1: [KAYAK, THEATRE], 2: [CLIMB, THEATRE] } })] })
      expect(r.conflicts(1)).toEqual([])
    })

    it('an unmet condition drops it on all its days without a conflict, even if met on some days', () => {
      // #1 on both days, "if 2 goes" – 2 has theatre only on day 1 (inconsistent data), so the condition fails on day 2
      const r = resolve({
        participants: [boy(1), boy(2)],
        offerings: ms,
        plans: [
          plan(1, { rankings: { 1: [THEATRE, KAYAK], 2: [THEATRE, CLIMB] }, conditions: { [THEATRE]: { people: [2], min: null } } }),
          plan(2, { rankings: { 1: [THEATRE], 2: [CLIMB] } }),
        ],
      })
      expect(r.conflicts(1)).toEqual([])
      expect(r.currentChoice(1, 1)).toBe(KAYAK)
      expect(r.currentChoice(1, 2)).toBe(CLIMB)
      expect(r.conditionMet(1, THEATRE, 1)).toBe(false)
    })

    it('with a condition met on all its days it is the current choice everywhere', () => {
      const r = resolve({
        participants: [boy(1), boy(2)],
        offerings: ms,
        plans: [
          plan(1, { rankings: { 1: [THEATRE, KAYAK], 2: [THEATRE, CLIMB] }, conditions: { [THEATRE]: { people: [], min: 1 } } }),
          plan(2, { rankings: { 1: [THEATRE], 2: [THEATRE] } }),
        ],
      })
      expect([r.currentChoice(1, 1), r.currentChoice(1, 2)]).toEqual([THEATRE, THEATRE])
      expect(r.conflicts(1)).toEqual([])
    })

    it('is a conflict when a condition makes the other day win', () => {
      // day 2: climbing only if 2 goes – he does, so climbing beats theatre on day 2
      const r = resolve({
        participants: [boy(1), boy(2)],
        offerings: ms,
        plans: [
          plan(1, { rankings: { 1: [THEATRE, KAYAK], 2: [CLIMB, THEATRE] }, conditions: { [CLIMB]: { people: [2], min: null } } }),
          plan(2, { rankings: { 2: [CLIMB] } }),
        ],
      })
      expect(r.conflicts(1)).toEqual([THEATRE])
      expect(r.currentChoice(1, 1)).toBe(KAYAK)
    })
  })

  it('terminates deterministically on a setup that would oscillate', () => {
    // 1: X if 2 at X, else Y.   2: Y if 1 at Y, else X.  Naive iteration flips forever.
    const X = KAYAK, Y = CLIMB
    const r = resolve({
      participants: [boy(1), boy(2)],
      offerings,
      plans: [
        plan(1, { rankings: { 1: [X, Y] }, conditions: { [X]: { people: [2], min: null } } }),
        plan(2, { rankings: { 1: [Y, X] }, conditions: { [Y]: { people: [1], min: null } } }),
      ],
    })
    expect(r.currentChoice(1, 1)).toBe(Y)
    expect(r.currentChoice(2, 1)).toBe(X)
  })
})
