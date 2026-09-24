import { useEffect, useState } from 'react'

type Health = { ok: boolean; camps: number }

export function App() {
  const [health, setHealth] = useState<Health | string>('…')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json() as Promise<Health>)
      .then(setHealth)
      .catch((e: unknown) => setHealth(String(e)))
  }, [])

  return (
    <main>
      <h1>Obóz – aktywności</h1>
      <pre>{typeof health === 'string' ? health : JSON.stringify(health)}</pre>
    </main>
  )
}
