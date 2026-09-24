import { Hono } from 'hono'
import { auth, type AppEnv } from './auth'
import { activeCamp } from './db'
import { admin } from './routes/admin'
import { me } from './routes/me'
import { plan } from './routes/plan'

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

// Any successful write bumps the version (1 row), which clients poll instead of the whole state.
app.use('*', async (c, next) => {
  await next()
  if (c.req.method !== 'GET' && c.res.ok) await c.env.DB.prepare('UPDATE app_version SET v = v + 1 WHERE id = 1').run()
})
app.get('/version', async (c) => {
  const row = await c.env.DB.prepare('SELECT v FROM app_version WHERE id = 1').first<{ v: number }>()
  return c.json({ v: row?.v ?? 0 })
})
app.route('/me', me)
app.get('/camp', async (c) => c.json(await activeCamp(c.env.DB)))
app.route('/admin', admin)
app.route('/', plan)

export default app
