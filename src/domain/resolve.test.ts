import { describe, expect, it } from 'vitest'
import { dayStatus, eligible, resolve, type Offering, type Participant, type Plan } from './index'

const boy = (id: number): Participant => ({ id, gender: 'M', bracket: 'U18' })
const girl = (id: number): Participant => ({ id, gender: 'K', bracket: 'U18' })
const single = (id: number, day: number, extra: Partial<Offering> = {}): Offering => ({
  id, days: [day], gender: null, brackets: null, ...extra,
})

function plan(participantId: number, p: Partial<Omit<Plan, 'participantId'>> = {}): Plan {
  return { participantId, rankings: {}, conditions: {}, statuses: {}, ...p }
}

const KAYAK = 10, CLIMB = 11, ARCHERY = 12, THEATRE = 20

describe('eligible', () => {
  it('respects gender and bracket restrictions', () => {
    const girlsOnly = single(1, 1, { gender: 'K' })
    const o18Only = single(2, 1, { brackets: ['O18'] })
    expect(eligible(girl(1), girlsOnly)).toBe(true)
    expect(eligible(boy(2), girlsOnly)).toBe(false)
    expect(eligible(girl(1), o18Only)).toBe(false)
    expect(eligible({ id: 3, gender: 'M', bracket: 'O18' }, o18Only)).toBe(true)
  })
})

describe('dayStatus', () => {
  it('is undecided with an empty ranking, wondering by default otherwise', () => {
    expect(dayStatus(plan(1), 1)).toBe('undecided')
    expect(dayStatus(plan(1, { rankings: { 1: [KAYAK] } }), 1)).toBe('wondering')
    expect(dayStatus(plan(1, { rankings: { 1: [KAYAK] }, statuses: { 1: 'registered' } }), 1)).toBe('registered')
  })

  it('an empty ranking is undecided even if a status was stored', () => {
    expect(dayStatus(plan(1, { rankings: { 1: [] }, statuses: { 1: 'decided' } }), 1)).toBe('undecided')
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
        plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { kind: 'people', people: [2] } } }),
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
        plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { kind: 'people', people: [2, 3] } } }),
        plan(2, { rankings: { 1: [CLIMB] } }),
        plan(3, { rankings: { 1: [ARCHERY, CLIMB] } }), // considers climbing but it isn't his current choice
      ],
    })
    expect(r.currentChoice(1, 1)).toBe(KAYAK)
  })

  it('"min N" counts only others of own gender, not the participant', () => {
    const plans = [
      plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { kind: 'min', min: 2 } } }),
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
        plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { kind: 'people', people: [2] } } }),
        plan(2, { rankings: { 1: [CLIMB, ARCHERY] }, conditions: { [CLIMB]: { kind: 'people', people: [1] } } }),
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
        plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { kind: 'people', people: [2] } } }),
        plan(2, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { kind: 'people', people: [3] } } }),
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
        plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { kind: 'people', people: [2] } } }),
        plan(2, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { kind: 'people', people: [3] } } }),
        plan(3, { rankings: { 1: [ARCHERY] } }),
      ],
    })
    expect([1, 2, 3].map((p) => r.currentChoice(p, 1))).toEqual([KAYAK, KAYAK, ARCHERY])
  })

  it('decided and registered days take #1 and ignore its condition', () => {
    const r = resolve({
      participants: [boy(1)],
      offerings,
      plans: [plan(1, { rankings: { 1: [CLIMB, KAYAK] }, conditions: { [CLIMB]: { kind: 'min', min: 5 } }, statuses: { 1: 'decided' } })],
    })
    expect(r.currentChoice(1, 1)).toBe(CLIMB)
  })

  describe('multi-day picks', () => {
    const theatre: Offering = { id: THEATRE, days: [1, 2], gender: null, brackets: null }
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

    it('is a conflict when a condition makes the other day win', () => {
      // day 2: climbing only if 2 goes – he does, so climbing beats theatre on day 2
      const r = resolve({
        participants: [boy(1), boy(2)],
        offerings: ms,
        plans: [
          plan(1, { rankings: { 1: [THEATRE, KAYAK], 2: [CLIMB, THEATRE] }, conditions: { [CLIMB]: { kind: 'people', people: [2] } } }),
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
        plan(1, { rankings: { 1: [X, Y] }, conditions: { [X]: { kind: 'people', people: [2] } } }),
        plan(2, { rankings: { 1: [Y, X] }, conditions: { [Y]: { kind: 'people', people: [1] } } }),
      ],
    })
    expect(r.currentChoice(1, 1)).toBe(Y)
    expect(r.currentChoice(2, 1)).toBe(X)
  })
})
