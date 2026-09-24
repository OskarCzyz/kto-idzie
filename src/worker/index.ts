import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>().basePath('/api')

app.get('/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS camps FROM camp').first<{ camps: number }>()
  return c.json({ ok: true, camps: row?.camps ?? 0 })
})

export default app
