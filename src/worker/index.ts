import { Hono } from 'hono'
import { auth, type AppEnv } from './auth'
import { activeCamp } from './db'
import { admin } from './routes/admin'
import { me } from './routes/me'

const app = new Hono<AppEnv>().basePath('/api')

app.get('/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS camps FROM camp').first<{ camps: number }>()
  return c.json({ ok: true, camps: row?.camps ?? 0 })
})

// Public: <img> tags can't send the auth header. Keys are random UUIDs.
app.get('/photos/:key{.+}', async (c) => {
  const obj = await c.env.PHOTOS.get(c.req.param('key'))
  if (!obj) return c.notFound()
  return new Response(obj.body, {
    headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
})

app.use('*', auth)
app.route('/me', me)
app.get('/camp', async (c) => c.json(await activeCamp(c.env.DB)))
app.route('/admin', admin)

export default app
