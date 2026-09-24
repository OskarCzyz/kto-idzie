import { Hono } from 'hono'
import { auth, type AppEnv } from './auth'
import { me } from './routes/me'

const app = new Hono<AppEnv>().basePath('/api')

app.get('/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS camps FROM camp').first<{ camps: number }>()
  return c.json({ ok: true, camps: row?.camps ?? 0 })
})

app.use('*', auth)
app.route('/me', me)

export default app
