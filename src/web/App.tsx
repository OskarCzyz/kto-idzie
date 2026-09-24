import { useEffect, useState } from 'react'
import type { Me } from '../shared/api'
import { api } from './api'
import { Admin } from './Admin'
import { Onboarding } from './Onboarding'

export function App() {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adminOpen, setAdminOpen] = useState(false)

  useEffect(() => {
    api<Me>('/me').then(setMe, (e: unknown) => setError(String(e)))
  }, [])

  if (error) return <div className="center">Nie udało się połączyć. Otwórz aplikację z Telegrama.<br />{error}</div>
  if (!me) return <div className="center muted">Ładowanie…</div>
  if (!me.onboarded) return <Onboarding me={me} onDone={setMe} />
  if (adminOpen && me.isOrganizer) return <Admin onClose={() => setAdminOpen(false)} />
  return (
    <div className="page">
      {me.isOrganizer && <div className="pad"><button className="chip" onClick={() => setAdminOpen(true)}>⚙️ Panel organizatora</button></div>}
      <div className="pad">
        <h1 style={{ fontSize: 20 }}>Cześć {me.firstName}</h1>
        <p className="muted">{me.gender === 'M' ? 'Chłopak' : 'Dziewczyna'} · {me.bracket}{me.isOrganizer ? ' · organizator' : ''}</p>
      </div>
    </div>
  )
}
