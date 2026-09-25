import { Hono } from 'hono'
import type { ActivityInput, CampInput, OfferingInput, ParticipantPatch } from '../../shared/api'
import type { Bracket } from '../../domain'
import { organizerOnly, type AppEnv, type ParticipantRow } from '../auth'
import { activeCamp, listActivities, listOfferings, toParticipant } from '../db'

const BRACKETS: Bracket[] = ['U15', 'U18', 'O18']
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

const bad = (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'Content-Type': 'application/json' } })

export const admin = new Hono<AppEnv>()
admin.use('*', organizerOnly)

// ---------- camp
admin.put('/camp', async (c) => {
  const body = await c.req.json<CampInput>()
  const db = c.env.DB
  if (!body.name?.trim()) return bad('name')
  const dayNos = body.days.map((d) => d.dayNo)
  if (dayNos.length < 1 || dayNos.length > 7 || new Set(dayNos).size !== dayNos.length) return bad('days')

  let camp = await activeCamp(db)
  const campId =
    camp?.id ??
    (await db.prepare('INSERT INTO camp (name) VALUES (?1) RETURNING id').bind(body.name.trim()).first<{ id: number }>())!.id

  await db.batch([
    db.prepare('UPDATE camp SET name = ?1 WHERE id = ?2').bind(body.name.trim(), campId),
    db.prepare(`DELETE FROM camp_day WHERE camp_id = ?1 AND day_no NOT IN (${dayNos.map(() => '?').join(',')})`).bind(campId, ...dayNos),
    ...body.days.map((d) =>
      db
        .prepare('INSERT INTO camp_day (camp_id, day_no, date) VALUES (?1, ?2, ?3) ON CONFLICT (camp_id, day_no) DO UPDATE SET date = excluded.date')
        .bind(campId, d.dayNo, d.date || null),
    ),
    db.prepare('DELETE FROM wave WHERE camp_id = ?1').bind(campId),
    ...BRACKETS.filter((b) => body.waves[b]).map((b) =>
      db.prepare('INSERT INTO wave (camp_id, bracket, opens_at, closes_at) VALUES (?1, ?2, ?3, ?4)').bind(campId, b, body.waves[b], body.waveEnds?.[b] || null),
    ),
  ])
  camp = await activeCamp(db)
  return c.json(camp)
})

/**
 * Ends the camp: deletes it with its days, waves, offerings, picks and statuses (cascade), and all
 * non-organizer participants. Activities and their logos stay for the next camp. Organizers stay but must
 * pick their age bracket again.
 */
admin.post('/camp/close', async (c) => {
  const db = c.env.DB
  const camp = await activeCamp(db)
  if (!camp) return bad('no-camp')
  await db.batch([
    db.prepare('DELETE FROM camp WHERE id = ?1').bind(camp.id),
    db.prepare('DELETE FROM participant WHERE is_organizer = 0'),
    db.prepare('UPDATE participant SET bracket = NULL'),
  ])
  return c.json({ ok: true })
})

// ---------- activities (library, outlives a camp)
admin.get('/activities', async (c) => c.json(await listActivities(c.env.DB)))

admin.post('/activities', async (c) => {
  const body = await c.req.json<ActivityInput>()
  if (!body.name?.trim()) return bad('name')
  const row = await c.env.DB.prepare('INSERT INTO activity (name) VALUES (?1) RETURNING id')
    .bind(body.name.trim())
    .first<{ id: number }>()
  return c.json({ id: row!.id })
})

admin.put('/activities/:id', async (c) => {
  const body = await c.req.json<ActivityInput>()
  if (!body.name?.trim()) return bad('name')
  await c.env.DB.prepare('UPDATE activity SET name = ?1 WHERE id = ?2')
    .bind(body.name.trim(), Number(c.req.param('id')))
    .run()
  return c.json({ ok: true })
})

admin.delete('/activities/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const { results } = await c.env.DB.prepare('SELECT r2_key FROM activity_photo WHERE activity_id = ?1').bind(id).all<{ r2_key: string }>()
  if (results.length) await c.env.PHOTOS.delete(results.map((r) => r.r2_key))
  await c.env.DB.prepare('DELETE FROM activity WHERE id = ?1').bind(id).run()
  return c.json({ ok: true })
})

async function deleteLogo(env: Env, activityId: number) {
  const { results } = await env.DB.prepare('DELETE FROM activity_photo WHERE activity_id = ?1 RETURNING r2_key').bind(activityId).all<{ r2_key: string }>()
  if (results.length) await env.PHOTOS.delete(results.map((r) => r.r2_key))
}

/** Sets the activity's logo, replacing the previous one. */
admin.put('/activities/:id/logo', async (c) => {
  const id = Number(c.req.param('id'))
  const file = (await c.req.formData()).get('file')
  if (!(file instanceof File) || !file.type.startsWith('image/')) return bad('file')
  if (file.size > MAX_PHOTO_BYTES) return bad('too-large')
  const key = `${id}/${crypto.randomUUID()}`
  await c.env.PHOTOS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } })
  await deleteLogo(c.env, id)
  await c.env.DB.prepare('INSERT INTO activity_photo (activity_id, r2_key, position) VALUES (?1, ?2, 0)').bind(id, key).run()
  return c.json({ ok: true })
})

admin.delete('/activities/:id/logo', async (c) => {
  await deleteLogo(c.env, Number(c.req.param('id')))
  return c.json({ ok: true })
})

// ---------- offerings (per camp)
async function validateOffering(c: { env: Env }, campId: number, body: OfferingInput): Promise<string | null> {
  if (!body.dayIds?.length) return 'days'
  if (body.gender !== null && body.gender !== 'M' && body.gender !== 'K') return 'gender'
  const caps = body.capacity ? [body.capacity.mentee, body.capacity.mentorIn, body.capacity.mentorOut] : []
  if (caps.length !== 3 || caps.some((n) => n !== null && !(Number.isInteger(n) && n >= 0))) return 'capacity'
  if (caps.every((n) => n === 0)) return 'capacity' // nobody could sign up
  const days = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM camp_day WHERE camp_id = ?1 AND id IN (${body.dayIds.map(() => '?').join(',')})`)
    .bind(campId, ...body.dayIds)
    .first<{ n: number }>()
  if (days!.n !== new Set(body.dayIds).size) return 'days'
  const act = await c.env.DB.prepare('SELECT 1 FROM activity WHERE id = ?1').bind(body.activityId).first()
  return act ? null : 'activity'
}

admin.get('/offerings', async (c) => {
  const camp = await activeCamp(c.env.DB)
  return c.json(camp ? await listOfferings(c.env.DB, camp.id) : [])
})

admin.post('/offerings', async (c) => {
  const camp = await activeCamp(c.env.DB)
  if (!camp) return bad('no-camp')
  const body = await c.req.json<OfferingInput>()
  const err = await validateOffering(c, camp.id, body)
  if (err) return bad(err)
  const db = c.env.DB
  const row = await db
    .prepare(
      `INSERT INTO offering (camp_id, activity_id, gender, capacity_mentee, capacity_mentor_in, capacity_mentor_out, high_demand)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING id`,
    )
    .bind(camp.id, body.activityId, body.gender, body.capacity.mentee, body.capacity.mentorIn, body.capacity.mentorOut, body.highDemand ? 1 : 0)
    .first<{ id: number }>()
  await db.batch(body.dayIds.map((d) => db.prepare('INSERT INTO offering_day (offering_id, camp_day_id) VALUES (?1, ?2)').bind(row!.id, d)))
  return c.json({ id: row!.id })
})

admin.put('/offerings/:id', async (c) => {
  const camp = await activeCamp(c.env.DB)
  if (!camp) return bad('no-camp')
  const id = Number(c.req.param('id'))
  const body = await c.req.json<OfferingInput>()
  const err = await validateOffering(c, camp.id, body)
  if (err) return bad(err)
  const db = c.env.DB
  const inDays = body.dayIds.map(() => '?').join(',')
  await db.batch([
    db.prepare(
      `UPDATE offering SET activity_id = ?1, gender = ?2, capacity_mentee = ?3, capacity_mentor_in = ?4, capacity_mentor_out = ?5, high_demand = ?6
       WHERE id = ?7 AND camp_id = ?8`,
    ).bind(body.activityId, body.gender, body.capacity.mentee, body.capacity.mentorIn, body.capacity.mentorOut, body.highDemand ? 1 : 0, id, camp.id),
    // Picks of participants who are no longer eligible go away.
    db.prepare('DELETE FROM pick WHERE offering_id = ?1 AND ?2 IS NOT NULL AND participant_id IN (SELECT id FROM participant WHERE gender IS NOT ?2)')
      .bind(id, body.gender),
    // …and so do picks of a signup group that was closed (capacity 0).
    db.prepare(
      `DELETE FROM pick WHERE offering_id = ?1 AND participant_id IN (
         SELECT id FROM participant WHERE (bracket IS NOT 'O18' AND ?2 = 0) OR (bracket = 'O18' AND ?3 = 0 AND ?4 = 0))`,
    ).bind(id, body.capacity.mentee, body.capacity.mentorIn, body.capacity.mentorOut),
    // A mentor whose role was closed switches to the other one (NULL = taking part).
    db.prepare(`UPDATE pick SET mentor_role = NULL WHERE offering_id = ?1 AND mentor_role = 'out' AND ?2 = 0`).bind(id, body.capacity.mentorOut),
    db.prepare(
      `UPDATE pick SET mentor_role = 'out' WHERE offering_id = ?1 AND ?2 = 0
         AND participant_id IN (SELECT id FROM participant WHERE bracket = 'O18')`,
    ).bind(id, body.capacity.mentorIn),
    // Days removed from the offering: drop them from rankings.
    db.prepare(`DELETE FROM pick_rank WHERE camp_day_id NOT IN (${inDays}) AND pick_id IN (SELECT id FROM pick WHERE offering_id = ?)`)
      .bind(...body.dayIds, id),
    db.prepare('DELETE FROM offering_day WHERE offering_id = ?1').bind(id),
    ...body.dayIds.flatMap((d) => [
      db.prepare('INSERT INTO offering_day (offering_id, camp_day_id) VALUES (?1, ?2)').bind(id, d),
      // Days added to the offering: existing picks go to the end of that day's ranking.
      db.prepare(
        `INSERT OR IGNORE INTO pick_rank (pick_id, camp_day_id, position)
         SELECT p.id, ?2, 1 + COALESCE((SELECT MAX(r.position) FROM pick_rank r JOIN pick q ON q.id = r.pick_id
                                       WHERE q.participant_id = p.participant_id AND r.camp_day_id = ?2), -1)
         FROM pick p WHERE p.offering_id = ?1`,
      ).bind(id, d),
    ]),
  ])
  return c.json({ ok: true })
})

admin.delete('/offerings/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM offering WHERE id = ?1').bind(Number(c.req.param('id'))).run()
  return c.json({ ok: true })
})

// ---------- participants
admin.get('/participants', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM participant ORDER BY first_name, last_name').all<ParticipantRow>()
  return c.json(results.map(toParticipant))
})

admin.put('/participants/:id', async (c) => {
  const body = await c.req.json<ParticipantPatch>()
  if (body.gender !== undefined && body.gender !== 'M' && body.gender !== 'K') return bad('gender')
  if (body.bracket !== undefined && !BRACKETS.includes(body.bracket)) return bad('bracket')
  const row = await c.env.DB.prepare(
    `UPDATE participant SET gender = COALESCE(?1, gender), bracket = COALESCE(?2, bracket),
       is_organizer = COALESCE(?3, is_organizer) WHERE id = ?4 RETURNING *`,
  )
    .bind(body.gender ?? null, body.bracket ?? null, body.isOrganizer === undefined ? null : body.isOrganizer ? 1 : 0, Number(c.req.param('id')))
    .first<ParticipantRow>()
  return row ? c.json(toParticipant(row)) : c.json({ error: 'not-found' }, 404)
})

admin.delete('/participants/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (id === c.get('me').id) return bad('self')
  const db = c.env.DB
  // Remove the person from other people's "people" conditions; an emptied condition is dropped.
  const { results } = await db
    .prepare('SELECT id, cond_people FROM pick WHERE EXISTS (SELECT 1 FROM json_each(pick.cond_people) WHERE value = ?1)')
    .bind(id)
    .all<{ id: number; cond_people: string }>()
  await db.batch([
    ...results.map((p) => {
      const rest = (JSON.parse(p.cond_people) as number[]).filter((x) => x !== id)
      return db.prepare('UPDATE pick SET cond_people = ?1 WHERE id = ?2').bind(rest.length ? JSON.stringify(rest) : null, p.id)
    }),
    db.prepare('DELETE FROM participant WHERE id = ?1').bind(id),
  ])
  return c.json({ ok: true })
})
