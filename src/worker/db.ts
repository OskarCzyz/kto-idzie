import type { Activity, Camp, Category, OfferingDto, ParticipantDto } from '../shared/api'
import type { Bracket, Gender } from '../domain'
import type { ParticipantRow } from './auth'

export const photoUrl = (key: string) => `/api/photos/${key}`

export async function activeCamp(db: D1Database): Promise<Camp | null> {
  const camp = await db.prepare('SELECT id, name FROM camp WHERE is_active = 1 ORDER BY id DESC LIMIT 1').first<{ id: number; name: string }>()
  if (!camp) return null
  const [days, waves] = await db.batch([
    db.prepare('SELECT id, day_no, date FROM camp_day WHERE camp_id = ?1 ORDER BY day_no').bind(camp.id),
    db.prepare('SELECT bracket, opens_at, closes_at FROM wave WHERE camp_id = ?1').bind(camp.id),
  ])
  const waveRows = waves!.results as { bracket: Bracket; opens_at: string; closes_at: string | null }[]
  return {
    ...camp,
    days: (days!.results as { id: number; day_no: number; date: string | null }[]).map((d) => ({ id: d.id, dayNo: d.day_no, date: d.date })),
    waves: Object.fromEntries(waveRows.map((w) => [w.bracket, w.opens_at])),
    waveEnds: Object.fromEntries(waveRows.filter((w) => w.closes_at).map((w) => [w.bracket, w.closes_at])),
  }
}

export async function listActivities(db: D1Database): Promise<Activity[]> {
  // The logo lives in activity_photo; there is at most one row per activity (upload replaces it).
  const { results } = await db
    .prepare(
      `SELECT a.id, a.name, a.category,
         (SELECT r2_key FROM activity_photo p WHERE p.activity_id = a.id ORDER BY p.id DESC LIMIT 1) AS logo_key
       FROM activity a ORDER BY a.name`,
    )
    .all<{ id: number; name: string; category: Category | null; logo_key: string | null }>()
  return results.map(({ logo_key, ...a }) => ({ ...a, logoUrl: logo_key ? photoUrl(logo_key) : null }))
}

interface OfferingRow {
  id: number
  activity_id: number
  gender: Gender | null
  capacity_mentee: number | null
  capacity_mentor_in: number | null
  capacity_mentor_out: number | null
  high_demand: number
  day_ids: string | null
}

export async function listOfferings(db: D1Database, campId: number): Promise<OfferingDto[]> {
  const { results } = await db
    .prepare(
      `SELECT o.*, (SELECT group_concat(camp_day_id) FROM offering_day WHERE offering_id = o.id) AS day_ids
       FROM offering o WHERE o.camp_id = ?1 ORDER BY o.id`,
    )
    .bind(campId)
    .all<OfferingRow>()
  return results.map((o) => ({
    id: o.id,
    activityId: o.activity_id,
    dayIds: (o.day_ids ?? '').split(',').filter(Boolean).map(Number).sort((a, b) => a - b),
    gender: o.gender,
    capacity: { mentee: o.capacity_mentee, mentorIn: o.capacity_mentor_in, mentorOut: o.capacity_mentor_out },
    highDemand: !!o.high_demand,
  }))
}

export const toParticipant = (p: ParticipantRow): ParticipantDto => ({
  id: p.id,
  firstName: p.first_name,
  lastName: p.last_name,
  username: p.username,
  photoUrl: p.photo_url,
  gender: p.gender,
  bracket: p.bracket,
  isOrganizer: !!p.is_organizer,
})
