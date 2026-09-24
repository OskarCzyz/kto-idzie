import { useEffect, useState } from 'react'
import type { Me } from '../shared/api'
import { Admin } from './Admin'
import { api } from './api'
import { Onboarding } from './Onboarding'
import { Planner } from './Planner'

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
  return <Planner me={me} onAdmin={me.isOrganizer ? () => setAdminOpen(true) : undefined} />
}
