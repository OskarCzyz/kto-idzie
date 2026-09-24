import type { Activity, Camp, OfferingDto, ParticipantDto } from '../shared/api'
import type { Bracket, Gender } from '../domain'
import type { ParticipantRow } from './auth'

export const photoUrl = (key: string) => `/api/photos/${key}`

export async function activeCamp(db: D1Database): Promise<Camp | null> {
  const camp = await db.prepare('SELECT id, name FROM camp WHERE is_active = 1 ORDER BY id DESC LIMIT 1').first<{ id: number; name: string }>()
  if (!camp) return null
  const [days, waves] = await db.batch([
    db.prepare('SELECT id, day_no, date FROM camp_day WHERE camp_id = ?1 ORDER BY day_no').bind(camp.id),
    db.prepare('SELECT bracket, opens_at FROM wave WHERE camp_id = ?1').bind(camp.id),
  ])
  return {
    ...camp,
    days: (days!.results as { id: number; day_no: number; date: string | null }[]).map((d) => ({ id: d.id, dayNo: d.day_no, date: d.date })),
    waves: Object.fromEntries((waves!.results as { bracket: Bracket; opens_at: string }[]).map((w) => [w.bracket, w.opens_at])),
  }
}

export async function listActivities(db: D1Database): Promise<Activity[]> {
  const [acts, photos] = await db.batch([
    db.prepare('SELECT id, name, description FROM activity ORDER BY name'),
    db.prepare('SELECT id, activity_id, r2_key FROM activity_photo ORDER BY position, id'),
  ])
  const byAct = new Map<number, { id: number; url: string }[]>()
  for (const p of photos!.results as { id: number; activity_id: number; r2_key: string }[]) {
    byAct.set(p.activity_id, [...(byAct.get(p.activity_id) ?? []), { id: p.id, url: photoUrl(p.r2_key) }])
  }
  return (acts!.results as { id: number; name: string; description: string }[]).map((a) => ({ ...a, photos: byAct.get(a.id) ?? [] }))
}

interface OfferingRow {
  id: number
  activity_id: number
  gender: Gender | null
  brackets: string | null
  capacity: number | null
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
    brackets: o.brackets ? (o.brackets.split(',') as Bracket[]) : null,
    capacity: o.capacity,
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
