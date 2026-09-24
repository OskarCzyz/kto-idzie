import { tg } from './telegram'

// Outside Telegram (local dev) the Worker accepts a fake user: add ?as=<n> to the URL to switch.
const asParam = new URLSearchParams(location.search).get('as')
if (asParam) sessionStorage.setItem('devUser', asParam)
const devUser = sessionStorage.getItem('devUser') ?? '1'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = tg ? { 'X-Telegram-Init-Data': tg.initData } : { 'X-Dev-User': devUser }
  let body: BodyInit | undefined
  if (init.body instanceof FormData) body = init.body
  else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.body)
  }
  const res = await fetch(`/api${path}`, { method: init.method ?? 'GET', headers, body })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json() as Promise<T>
}
