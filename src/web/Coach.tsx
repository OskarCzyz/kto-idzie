import { useEffect, useState } from 'react'

export type CoachStep = { target: string; text: string }

/**
 * First-visit hints: highlights the element marked `data-coach={target}` and explains it.
 * Seen once per browser; the "?" button shows them again.
 */
export function Coach({ id, steps }: { id: string; steps: CoachStep[] }) {
  const key = `coach-${id}`
  const [i, setI] = useState(() => {
    try {
      return localStorage.getItem(key) ? -1 : 0
    } catch {
      return 0
    }
  })

  const target = i < 0 ? null : steps[i]!.target
  useEffect(() => {
    const clear = () => document.querySelectorAll('.coach-hl').forEach((e) => e.classList.remove('coach-hl'))
    clear()
    if (!target) return
    const el = document.querySelector(`[data-coach="${target}"]`)
    el?.classList.add('coach-hl')
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return clear
  }, [i, target])

  const finish = () => {
    try {
      localStorage.setItem(key, '1')
    } catch {}
    setI(-1)
  }

  if (i < 0) return <button className="coach-replay" onClick={() => setI(0)} aria-label="Jak to działa?">?</button>
  return (
    <div className="coach">
      <div className="small muted">Jak to działa · {i + 1}/{steps.length}</div>
      <div style={{ margin: '4px 0 10px' }}>{steps[i]!.text}</div>
      <div className="row">
        <button className="linkb" onClick={finish}>Pomiń</button>
        <span className="sp" />
        <button className="btn sm" onClick={() => (i + 1 < steps.length ? setI(i + 1) : finish())}>{i + 1 < steps.length ? 'Dalej' : 'Rozumiem'}</button>
      </div>
    </div>
  )
}
