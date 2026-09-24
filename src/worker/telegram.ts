// Validation of Telegram Mini App initData:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

const MAX_AGE_SECONDS = 24 * 60 * 60
const enc = new TextEncoder()

async function hmac(key: BufferSource, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(data))
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function signInitData(fields: Record<string, string>, botToken: string): Promise<string> {
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n')
  const secret = await hmac(enc.encode('WebAppData'), botToken)
  return hex(await hmac(secret, check))
}

/** Returns the Telegram user if `initData` is authentic and fresh, otherwise null. */
export async function validateInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<TelegramUser | null> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const fields = Object.fromEntries(params)
  if ((await signInitData(fields, botToken)) !== hash) return null
  const authDate = Number(fields.auth_date)
  if (!Number.isFinite(authDate) || nowSeconds - authDate > MAX_AGE_SECONDS) return null
  try {
    const user = JSON.parse(fields.user ?? '') as TelegramUser
    return typeof user.id === 'number' && typeof user.first_name === 'string' ? user : null
  } catch {
    return null
  }
}
