import { createMiddleware } from 'hono/factory'
import { validateInitData, type TelegramUser } from './telegram'

export interface ParticipantRow {
  id: number
  telegram_id: number
  first_name: string
  last_name: string | null
  username: string | null
  photo_url: string | null
  gender: 'M' | 'K' | null
  bracket: 'U15' | 'U18' | 'O18' | null
  is_organizer: number
}

export type AppEnv = { Bindings: Env; Variables: { me: ParticipantRow } }

/**
 * Identifies the caller from Telegram initData (ADR 0001) and creates the participant on first visit.
 * With DEV_AUTH=1 and no initData, `X-Dev-User: <telegram id>` picks a fake user for local testing.
 */
export const auth = createMiddleware<AppEnv>(async (c, next) => {
  const initData = c.req.header('X-Telegram-Init-Data')
  let user: TelegramUser | null = null
  if (initData) user = await validateInitData(initData, c.env.BOT_TOKEN)
  else if (c.env.DEV_AUTH === '1') {
    const id = Number(c.req.header('X-Dev-User') ?? '1')
    user = { id, first_name: `Dev ${id}` }
  }
  if (!user) return c.json({ error: 'unauthorized' }, 401)

  const organizerIds = c.env.ORGANIZER_TELEGRAM_IDS.split(',').map((s: string) => s.trim()).filter(Boolean)
  const seededOrganizer = organizerIds.includes(String(user.id)) || (c.env.DEV_AUTH === '1' && user.id === 1) ? 1 : 0

  // Read first and write only when something changed: this runs on every request, including polls,
  // and D1's free tier allows far fewer writes than reads.
  const db = c.env.DB
  let me = await db.prepare('SELECT * FROM participant WHERE telegram_id = ?1').bind(user.id).first<ParticipantRow>()
  const fresh = { first_name: user.first_name, last_name: user.last_name ?? null, username: user.username ?? null, photo_url: user.photo_url ?? null }
  if (!me) {
    me = await db
      .prepare('INSERT INTO participant (telegram_id, first_name, last_name, username, photo_url, is_organizer) VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING *')
      .bind(user.id, fresh.first_name, fresh.last_name, fresh.username, fresh.photo_url, seededOrganizer)
      .first<ParticipantRow>()
  } else if (
    me.first_name !== fresh.first_name || me.last_name !== fresh.last_name || me.username !== fresh.username ||
    me.photo_url !== fresh.photo_url || (seededOrganizer && !me.is_organizer)
  ) {
    me = await db
      .prepare('UPDATE participant SET first_name = ?1, last_name = ?2, username = ?3, photo_url = ?4, is_organizer = MAX(is_organizer, ?5) WHERE id = ?6 RETURNING *')
      .bind(fresh.first_name, fresh.last_name, fresh.username, fresh.photo_url, seededOrganizer, me.id)
      .first<ParticipantRow>()
  }
  c.set('me', me!)
  await next()
})

export const organizerOnly = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('me').is_organizer) return c.json({ error: 'forbidden' }, 403)
  await next()
})
