import { useCallback, useEffect, useRef, useState } from 'react'
import type { Plan } from '../domain'
import type { CampState } from '../shared/api'
import { api } from './api'

const POLL_MS = 10_000

/**
 * Loads the whole camp state and keeps it fresh by polling while the app is visible.
 * `savePlan` applies my plan locally at once (optimistic) and then stores it; the server's
 * normalized version replaces the local one when it comes back.
 */
export function useCampState(meId: number) {
  const [state, setState] = useState<CampState | null | undefined>(undefined)
  const [saveError, setSaveError] = useState<string | null>(null)
  const pending = useRef(0) // saves in flight – don't let a poll overwrite an optimistic plan

  const withMyPlan = (s: CampState, plan: Plan): CampState => ({
    ...s,
    plans: [...s.plans.filter((p) => p.participantId !== meId), plan],
  })

  const refresh = useCallback(async () => {
    const fresh = await api<CampState | null>('/state')
    if (pending.current === 0) setState(fresh)
  }, [])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh().catch(() => {})
    }, POLL_MS)
    const onVisible = () => document.visibilityState === 'visible' && void refresh().catch(() => {})
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const savePlan = useCallback(
    async (plan: Plan) => {
      setState((s) => (s ? withMyPlan(s, plan) : s))
      pending.current++
      try {
        const stored = await api<Plan>('/plan', { method: 'PUT', body: plan })
        setSaveError(null)
        if (pending.current === 1) setState((s) => (s ? withMyPlan(s, stored) : s))
      } catch {
        setSaveError('Nie udało się zapisać – spróbuj ponownie.')
        pending.current--
        await refresh().catch(() => {})
        return
      }
      pending.current--
    },
    [refresh, meId],
  )

  return { state, savePlan, saveError, refresh }
}
