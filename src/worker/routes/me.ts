import { Hono } from 'hono'
import type { Me } from '../../shared/api'
import type { AppEnv, ParticipantRow } from '../auth'

export const toMe = (p: ParticipantRow): Me => ({
  id: p.id,
  firstName: p.first_name,
  lastName: p.last_name,
  username: p.username,
  photoUrl: p.photo_url,
  gender: p.gender,
  bracket: p.bracket,
  isOrganizer: !!p.is_organizer,
  onboarded: !!(p.gender && p.bracket),
})

export const me = new Hono<AppEnv>()
  .get('/', (c) => c.json(toMe(c.get('me'))))
  .put('/', async (c) => {
    const body = await c.req.json<{ gender?: unknown; bracket?: unknown }>()
    if (body.gender !== 'M' && body.gender !== 'K') return c.json({ error: 'gender' }, 400)
    if (body.bracket !== 'U15' && body.bracket !== 'U18' && body.bracket !== 'O18') return c.json({ error: 'bracket' }, 400)
    const row = await c.env.DB.prepare('UPDATE participant SET gender = ?1, bracket = ?2 WHERE id = ?3 RETURNING *')
      .bind(body.gender, body.bracket, c.get('me').id)
      .first<ParticipantRow>()
    return c.json(toMe(row!))
  })
