import { Hono } from 'hono'
import { normalizePlan, type Condition, type Offering, type Plan, type StoredDayStatus } from '../../domain'
import type { CampState, OfferingDto, PersonDto } from '../../shared/api'
import type { AppEnv, ParticipantRow } from '../auth'
import { activeCamp, listActivities, listOfferings } from '../db'

export const toDomainOffering = (o: OfferingDto): Offering => ({ id: o.id, days: o.dayIds, gender: o.gender, brackets: o.brackets })

async function loadPeople(db: D1Database): Promise<PersonDto[]> {
  const { results } = await db
    .prepare('SELECT * FROM participant WHERE gender IS NOT NULL AND bracket IS NOT NULL ORDER BY first_name, last_name')
    .all<ParticipantRow>()
  return results.map((p) => ({
    id: p.id, firstName: p.first_name, lastName: p.last_name, username: p.username, photoUrl: p.photo_url, gender: p.gender!, bracket: p.bracket!,
  }))
}

async function loadPlans(db: D1Database, campId: number): Promise<Plan[]> {
  const [ranks, statuses] = await db.batch([
    db
      .prepare(
        `SELECT p.participant_id, p.offering_id, p.cond_people, p.cond_min, r.camp_day_id, r.position
         FROM pick p JOIN pick_rank r ON r.pick_id = p.id JOIN camp_day d ON d.id = r.camp_day_id
         WHERE d.camp_id = ?1 ORDER BY p.participant_id, r.camp_day_id, r.position`,
      )
      .bind(campId),
    db.prepare('SELECT s.* FROM day_status s JOIN camp_day d ON d.id = s.camp_day_id WHERE d.camp_id = ?1').bind(campId),
  ])
  const plans = new Map<number, Plan>()
  const planOf = (pid: number) => {
    let p = plans.get(pid)
    if (!p) plans.set(pid, (p = { participantId: pid, rankings: {}, conditions: {}, statuses: {} }))
    return p
  }
  type RankRow = { participant_id: number; offering_id: number; cond_people: string | null; cond_min: number | null; camp_day_id: number }
  for (const r of ranks!.results as RankRow[]) {
    const p = planOf(r.participant_id)
    ;(p.rankings[r.camp_day_id] ??= []).push(r.offering_id)
    if (r.cond_people) p.conditions[r.offering_id] = { kind: 'people', people: JSON.parse(r.cond_people) as number[] }
    else if (r.cond_min != null) p.conditions[r.offering_id] = { kind: 'min', min: r.cond_min }
  }
  for (const s of statuses!.results as { participant_id: number; camp_day_id: number; status: StoredDayStatus }[]) {
    planOf(s.participant_id).statuses[s.camp_day_id] = s.status
  }
  return [...plans.values()]
}

export const plan = new Hono<AppEnv>()
  .get('/state', async (c) => {
    const db = c.env.DB
    const camp = await activeCamp(db)
    if (!camp) return c.json(null)
    const [offerings, activities, people, plans] = await Promise.all([listOfferings(db, camp.id), listActivities(db), loadPeople(db), loadPlans(db, camp.id)])
    const used = new Set(offerings.map((o) => o.activityId))
    const state: CampState = { camp, offerings, activities: activities.filter((a) => used.has(a.id)), people, plans }
    return c.json(state)
  })
  /** Replaces the caller's whole plan (after normalizing it) and returns what was stored. */
  .put('/plan', async (c) => {
    const db = c.env.DB
    const me = c.get('me')
    if (!me.gender || !me.bracket) return c.json({ error: 'not-onboarded' }, 400)
    const camp = await activeCamp(db)
    if (!camp) return c.json({ error: 'no-camp' }, 400)
    const [offerings, people] = await Promise.all([listOfferings(db, camp.id), loadPeople(db)])
    const body = await c.req.json<Plan>()
    const clean = normalizePlan(
      { participantId: me.id, rankings: body.rankings ?? {}, conditions: body.conditions ?? {}, statuses: body.statuses ?? {} },
      offerings.map(toDomainOffering),
      { id: me.id, gender: me.gender, bracket: me.bracket },
      new Set(people.map((p) => p.id)),
    )
    const dayIds = camp.days.map((d) => d.id)
    const inDays = dayIds.map(() => '?').join(',')
    const picked = [...new Set(Object.values(clean.rankings).flat())]
    const condCols = (c?: Condition) => [c?.kind === 'people' ? JSON.stringify(c.people) : null, c?.kind === 'min' ? c.min : null]
    await db.batch([
      db.prepare(`DELETE FROM pick WHERE participant_id = ?1 AND offering_id IN (SELECT id FROM offering WHERE camp_id = ?2)`).bind(me.id, camp.id),
      db.prepare(`DELETE FROM day_status WHERE participant_id = ? AND camp_day_id IN (${inDays})`).bind(me.id, ...dayIds),
      ...picked.map((oid) =>
        db.prepare('INSERT INTO pick (participant_id, offering_id, cond_people, cond_min) VALUES (?1, ?2, ?3, ?4)').bind(me.id, oid, ...condCols(clean.conditions[oid])),
      ),
      ...Object.entries(clean.rankings).flatMap(([day, ranking]) =>
        ranking.map((oid, pos) =>
          db
            .prepare('INSERT INTO pick_rank (pick_id, camp_day_id, position) SELECT id, ?1, ?2 FROM pick WHERE participant_id = ?3 AND offering_id = ?4')
            .bind(Number(day), pos, me.id, oid),
        ),
      ),
      ...Object.entries(clean.statuses)
        .filter(([, s]) => s !== 'wondering')
        .map(([day, s]) => db.prepare('INSERT INTO day_status (participant_id, camp_day_id, status) VALUES (?1, ?2, ?3)').bind(me.id, Number(day), s)),
    ])
    return c.json(clean)
  })
