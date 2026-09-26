import { describe, expect, it } from 'vitest'
import { addPick, keepOnAllDays, movePick, normalizePlan, removePick, setDayStatus, setMentorRole, type Offering, type Plan } from './index'

const o = (id: number, days: number[], extra: Partial<Offering> = {}): Offering => ({ id, days, gender: null, closed: [], ...extra })
const KAYAK = o(1, [1]), CLIMB = o(2, [2]), THEATRE = o(3, [1, 2]), ARCHERY = o(4, [1]), GIRLS = o(5, [1], { gender: 'K' })
const offerings = [KAYAK, CLIMB, THEATRE, ARCHERY, GIRLS]
const empty: Plan = { participantId: 1, rankings: {}, conditions: {}, statuses: {}, mentorRoles: {} }

describe('plan editing', () => {
  it('adds a multi-day pick to the end of every day it covers', () => {
    const p = addPick(addPick(empty, CLIMB), THEATRE)
    expect(p.rankings).toEqual({ 1: [3], 2: [2, 3] })
  })

  it('adding twice is a no-op; condition is stored', () => {
    const p = addPick(addPick(empty, KAYAK, { people: [], min: 2 }), KAYAK)
    expect(p.rankings[1]).toEqual([1])
    expect(p.conditions[1]).toEqual({ people: [], min: 2 })
  })

  it('removes a pick from all days with its condition, and clears status of emptied days', () => {
    let p = addPick(addPick(empty, THEATRE, { people: [], min: 1 }), ARCHERY)
    p = setDayStatus(p, 2, 'registered', offerings)
    p = removePick(p, THEATRE)
    expect(p.rankings).toEqual({ 1: [4], 2: [] })
    expect(p.conditions).toEqual({})
    expect(p.statuses[2]).toBeUndefined()
  })

  it('moving changes order; a new #1 sets the day back to wondering', () => {
    let p = addPick(addPick(addPick(empty, KAYAK), ARCHERY), THEATRE)
    p = setDayStatus(p, 1, 'registered', offerings)
    const reordered = movePick(p, 1, 2, 1)
    expect(reordered.rankings[1]).toEqual([1, 3, 4])
    expect(reordered.statuses[1]).toBe('registered')
    const newTop = movePick(p, 1, 2, 0)
    expect(newTop.rankings[1]).toEqual([3, 1, 4])
    expect(newTop.statuses[1]).toBeUndefined()
  })

  it('registering a multi-day #1 puts it first on all its days with the same status', () => {
    let p = addPick(addPick(addPick(empty, THEATRE), KAYAK), CLIMB) // day 2: theatre, climb
    p = movePick(p, 2, 1, 0) // day 2: climb, theatre
    p = setDayStatus(p, 1, 'registered', offerings)
    expect(p.rankings).toEqual({ 1: [3, 1], 2: [3, 2] })
    expect(p.statuses).toEqual({ 1: 'registered', 2: 'registered' })
  })

  it('keepOnAllDays resolves a conflict by moving the pick to #1 everywhere', () => {
    let p = addPick(addPick(addPick(empty, THEATRE), CLIMB), KAYAK)
    p = movePick(p, 2, 1, 0)
    p = setDayStatus(p, 2, 'registered', offerings)
    p = keepOnAllDays(p, THEATRE)
    expect(p.rankings).toEqual({ 1: [3, 1], 2: [3, 2] })
    expect(p.statuses[2]).toBeUndefined()
  })
})

describe('normalizePlan', () => {
  const me = { id: 1, gender: 'M' as const, bracket: 'U18' as const }

  it('drops unknown and ineligible offerings, and picks on days they do not cover', () => {
    const p = normalizePlan({ ...empty, rankings: { 1: [1, 99, 5, 2] } }, offerings, me, new Set([1, 2]))
    expect(p.rankings[1]).toEqual([1])
  })

  it('adds a multi-day pick to days where it is missing, removes duplicates', () => {
    const p = normalizePlan({ ...empty, rankings: { 1: [3, 3, 1] } }, offerings, me, new Set([1]))
    expect(p.rankings).toEqual({ 1: [3, 1], 2: [3] })
  })

  it('drops conditions of removed picks, self-references, unknown people and invalid mins', () => {
    const p = normalizePlan(
      {
        ...empty,
        rankings: { 1: [1, 4] },
        conditions: { 1: { people: [1, 2, 77], min: 3 }, 4: { people: [], min: 0 }, 2: { people: [], min: 3 } },
        statuses: { 1: 'registered', 2: 'registered' },
      },
      offerings,
      me,
      new Set([1, 2]),
    )
    expect(p.conditions).toEqual({ 1: { people: [2], min: 3 } })
    expect(p.statuses).toEqual({ 1: 'registered' })
  })

  it('keeps mentor roles only for an O18 participant and only for picked offerings', () => {
    const plan = { ...setMentorRole(setMentorRole(empty, 1, 'out'), 2, 'out'), rankings: { 1: [1] } }
    expect(normalizePlan(plan, offerings, { ...me, bracket: 'O18' }, new Set([1])).mentorRoles).toEqual({ 1: 'out' })
    expect(normalizePlan(plan, offerings, me, new Set([1])).mentorRoles).toEqual({})
  })

  it('switches a mentor to the other role when theirs is closed', () => {
    const noOut = o(6, [2], { closed: ['mentorOut'] }), noIn = o(7, [2], { closed: ['mentorIn'] })
    const plan = { ...empty, rankings: { 2: [6, 7] }, mentorRoles: { 6: 'out' as const } }
    expect(normalizePlan(plan, [noOut, noIn], { ...me, bracket: 'O18' }, new Set([1])).mentorRoles).toEqual({ 7: 'out' })
  })
})
