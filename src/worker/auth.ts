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

  const me = await c.env.DB.prepare(
    `INSERT INTO participant (telegram_id, first_name, last_name, username, photo_url, is_organizer)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (telegram_id) DO UPDATE SET
       first_name = excluded.first_name, last_name = excluded.last_name, username = excluded.username,
       photo_url = excluded.photo_url, is_organizer = MAX(participant.is_organizer, excluded.is_organizer)
     RETURNING *`,
  )
    .bind(user.id, user.first_name, user.last_name ?? null, user.username ?? null, user.photo_url ?? null, seededOrganizer)
    .first<ParticipantRow>()
  c.set('me', me!)
  await next()
})

export const organizerOnly = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('me').is_organizer) return c.json({ error: 'forbidden' }, 403)
  await next()
})
