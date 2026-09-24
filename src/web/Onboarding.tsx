import { useState } from 'react'
import type { Me } from '../shared/api'
import { api } from './api'
import { Hero } from './Hero'

export function Onboarding({ me, onDone }: { me: Me; onDone: (me: Me) => void }) {
  const [gender, setGender] = useState(me.gender)
  const [bracket, setBracket] = useState(me.bracket)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      onDone(await api<Me>('/me', { method: 'PUT', body: { gender, bracket } }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <Hero />
      <div className="pad">
        <h1 style={{ fontSize: 22 }}>Cześć {me.firstName}! 👋</h1>
        <p className="muted">Dwie rzeczy, żeby pokazać Ci aktywności, na które możesz się zapisać.</p>
      </div>
      <div className="h3">Jestem</div>
      <div className="card pad choice-grid">
        {(['M', 'K'] as const).map((g) => (
          <button key={g} className={`choice ${gender === g ? 'on' : ''}`} onClick={() => setGender(g)}>
            {g === 'M' ? 'Chłopakiem' : 'Dziewczyną'}
          </button>
        ))}
      </div>
      <div className="h3">Grupa wiekowa</div>
      <div className="card pad choice-grid three">
        {(['U15', 'U18', 'O18'] as const).map((b) => (
          <button key={b} className={`choice ${bracket === b ? 'on' : ''}`} onClick={() => setBracket(b)}>
            {b}
          </button>
        ))}
      </div>
      <div className="pad">
        <button className="btn" style={{ width: '100%' }} disabled={!gender || !bracket || saving} onClick={save}>
          Dalej
        </button>
      </div>
    </div>
  )
}
