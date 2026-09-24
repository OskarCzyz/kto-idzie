import { describe, expect, it } from 'vitest'
import { signInitData, validateInitData } from './telegram'

const TOKEN = '123456:TEST'
const NOW = 1_800_000_000

async function initData(fields: Record<string, string>, token = TOKEN) {
  const hash = await signInitData(fields, token)
  return new URLSearchParams({ ...fields, hash }).toString()
}

const user = JSON.stringify({ id: 42, first_name: 'Kuba', username: 'kuba' })

describe('validateInitData', () => {
  it('accepts correctly signed, fresh data', async () => {
    const data = await initData({ auth_date: String(NOW - 60), query_id: 'q', user })
    expect(await validateInitData(data, TOKEN, NOW)).toMatchObject({ id: 42, first_name: 'Kuba' })
  })

  it('rejects data signed with another bot token', async () => {
    const data = await initData({ auth_date: String(NOW), user }, 'other:TOKEN')
    expect(await validateInitData(data, TOKEN, NOW)).toBeNull()
  })

  it('rejects tampered fields', async () => {
    const data = (await initData({ auth_date: String(NOW), user })).replace('Kuba', 'Tomek')
    expect(await validateInitData(data, TOKEN, NOW)).toBeNull()
  })

  it('rejects data older than 24 h', async () => {
    const data = await initData({ auth_date: String(NOW - 25 * 3600), user })
    expect(await validateInitData(data, TOKEN, NOW)).toBeNull()
  })

  it('rejects missing hash or user', async () => {
    expect(await validateInitData('auth_date=1', TOKEN, NOW)).toBeNull()
    expect(await validateInitData(await initData({ auth_date: String(NOW) }), TOKEN, NOW)).toBeNull()
  })
})
