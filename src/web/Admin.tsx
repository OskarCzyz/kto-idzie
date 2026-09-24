import { useCallback, useEffect, useState } from 'react'
import type { Activity, Camp, CampInput, OfferingDto, OfferingInput, ParticipantDto } from '../shared/api'
import type { Bracket, Gender } from '../domain'
import { api } from './api'
import { Thumb } from './ui'
import { confirmAsync } from './telegram'

const BRACKETS: Bracket[] = ['U15', 'U18', 'O18']
type Tab = 'camp' | 'activities' | 'participants'
const TABS: [Tab, string][] = [['camp', 'Obóz'], ['activities', 'Aktywności'], ['participants', 'Uczestnicy']]

export function Admin({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('camp')
  const [camp, setCamp] = useState<Camp | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const reloadCamp = useCallback(() => api<Camp | null>('/camp').then(setCamp), [])
  const reloadActivities = useCallback(() => api<Activity[]>('/admin/activities').then(setActivities), [])
  useEffect(() => {
    void reloadCamp()
    void reloadActivities()
  }, [reloadCamp, reloadActivities])

  return (
    <div className="page">
      <div className="topbar row">
        <b>⚙️ Panel organizatora</b>
        <span className="sp" />
        <button className="chip" onClick={onClose}>✕ Zamknij</button>
      </div>
      <div className="chips">
        {TABS.map(([k, l]) => (
          <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'camp' && <CampForm camp={camp} onSaved={setCamp} />}
      {tab === 'camp' && camp && <CloseCamp onClosed={() => location.reload()} />}
      {tab === 'activities' && <Activities camp={camp} activities={activities} reload={reloadActivities} />}
      {tab === 'participants' && <Participants />}
    </div>
  )
}

// ---------------- camp
function CampForm({ camp, onSaved }: { camp: Camp | null; onSaved: (c: Camp) => void }) {
  const [form, setForm] = useState<CampInput>({ name: '', days: [1, 2, 3].map((n) => ({ dayNo: n, date: null })), waves: {}, waveEnds: {} })
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (camp) setForm({ name: camp.name, days: camp.days.map((d) => ({ dayNo: d.dayNo, date: d.date })), waves: camp.waves, waveEnds: camp.waveEnds })
  }, [camp])

  const setDayCount = (n: number) =>
    setForm((f) => ({ ...f, days: Array.from({ length: n }, (_, i) => f.days[i] ?? { dayNo: i + 1, date: null }) }))

  async function save() {
    if (camp && form.days.length < camp.days.length && !(await confirmAsync('Usunięcie dni skasuje oferty i wybory z tych dni. Kontynuować?'))) return
    onSaved(await api<Camp>('/admin/camp', { method: 'PUT', body: form }))
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="card pad form">
      <label>Nazwa<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Obóz 2026" /></label>
      <label>Liczba dni
        <select className="input" value={form.days.length} onChange={(e) => setDayCount(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n}>{n}</option>)}
        </select>
      </label>
      {form.days.map((d, i) => (
        <label key={d.dayNo}>Dzień {d.dayNo}
          <input className="input" type="date" value={d.date ?? ''} onChange={(e) => setForm({ ...form, days: form.days.map((x, j) => (j === i ? { ...x, date: e.target.value || null } : x)) })} />
        </label>
      ))}
      <div className="h3" style={{ margin: '10px 0 4px' }}>Zapisy (fale)</div>
      <div className="small muted">Start i koniec zapisów dla grupy wiekowej. Koniec jest tylko informacyjny i można go pominąć.</div>
      {BRACKETS.map((b) => (
        <div key={b} className="wave-row">
          <b>{b}</b>
          <label>od
            <input className="input" type="date" value={form.waves[b] ?? ''} onChange={(e) => setForm({ ...form, waves: { ...form.waves, [b]: e.target.value || undefined } })} />
          </label>
          <label>do
            <input className="input" type="date" disabled={!form.waves[b]} min={form.waves[b]} value={form.waveEnds[b] ?? ''} onChange={(e) => setForm({ ...form, waveEnds: { ...form.waveEnds, [b]: e.target.value || undefined } })} />
          </label>
        </div>
      ))}
      <button className="btn" onClick={save} disabled={!form.name.trim()}>{saved ? '✓ Zapisano' : 'Zapisz'}</button>
    </div>
  )
}

function CloseCamp({ onClosed }: { onClosed: () => void }) {
  async function close() {
    if (!(await confirmAsync('Zakończyć obóz? Usunie to oferty, wszystkie wybory i uczestników (poza organizatorami). Aktywności ze zdjęciami zostaną na następny obóz.'))) return
    await api('/admin/camp/close', { method: 'POST' })
    onClosed()
  }
  return (
    <div className="card pad">
      <div className="b">Koniec obozu</div>
      <div className="small muted" style={{ margin: '4px 0 8px' }}>Gdy wszyscy są już zapisani. Aktywności zostają, żeby użyć ich przy kolejnym obozie.</div>
      <button className="btn ghost danger" onClick={close}>Zakończ obóz</button>
    </div>
  )
}

// ---------------- activities + their offerings ("terminy") in one form
type Slot = Omit<OfferingInput, 'activityId'> & { id?: number } // one offering of the activity, being edited

const emptySlot = (): Slot => ({ dayIds: [], gender: null, brackets: null, capacity: null, highDemand: false })

function slotText(camp: Camp, o: Slot) {
  const nos = o.dayIds.map((id) => camp.days.find((d) => d.id === id)?.dayNo).filter(Boolean)
  return [
    nos.length ? `dzień ${nos.join(', ')}` : 'bez dni',
    o.gender === 'K' ? 'tylko dziewczyny' : o.gender === 'M' ? 'tylko chłopcy' : '',
    o.brackets?.join('/') ?? '',
    o.capacity ? `max ${o.capacity}` : 'bez limitu',
    o.highDemand ? '🔥' : '',
  ].filter(Boolean).join(' · ')
}

function Activities({ camp, activities, reload }: { camp: Camp | null; activities: Activity[]; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [offerings, setOfferings] = useState<OfferingDto[]>([])
  const reloadOfferings = useCallback(() => api<OfferingDto[]>('/admin/offerings').then(setOfferings), [])
  useEffect(() => void reloadOfferings(), [reloadOfferings])
  const done = () => { setEditing(null); void reload(); void reloadOfferings() }
  const of = (activityId: number) => offerings.filter((o) => o.activityId === activityId)
  // Activities used in this camp first; the rest is the library from earlier camps.
  const sorted = [...activities].sort((a, b) => Number(of(b.id).length > 0) - Number(of(a.id).length > 0))

  return (
    <>
      {!camp && <p className="pad small muted" style={{ margin: 0 }}>Terminy dodasz po ustawieniu obozu (zakładka Obóz).</p>}
      <div className="pad"><button className="btn" onClick={() => setEditing('new')}>+ Nowa aktywność</button></div>
      {editing === 'new' && <ActivityForm camp={camp} offerings={[]} onDone={done} />}
      {sorted.map((a) =>
        editing === a.id ? (
          <ActivityForm key={a.id} camp={camp} activity={a} offerings={of(a.id)} onDone={done} />
        ) : (
          <div key={a.id} className="card pad row" onClick={() => setEditing(a.id)} style={{ cursor: 'pointer', alignItems: 'flex-start', opacity: of(a.id).length ? 1 : 0.55 }}>
            <Thumb activity={a} size={56} />
            <div style={{ minWidth: 0 }}>
              <div className="b">{a.name}</div>
              {camp && of(a.id).length ? (
                of(a.id).map((o) => <div key={o.id} className="small muted">{slotText(camp, o)}</div>)
              ) : (
                <div className="small muted">nie ma w tym obozie – dotknij, żeby dodać termin</div>
              )}
            </div>
          </div>
        ),
      )}
    </>
  )
}

function ActivityForm({ camp, activity, offerings, onDone }: { camp: Camp | null; activity?: Activity; offerings: OfferingDto[]; onDone: () => void }) {
  const [name, setName] = useState(activity?.name ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [logo, setLogo] = useState<File | null>(null) // picked but not uploaded yet
  const [removeLogo, setRemoveLogo] = useState(false)
  const [slots, setSlots] = useState<Slot[]>(() => (offerings.length ? offerings.map(({ activityId: _, ...o }) => o) : camp ? [emptySlot()] : []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = logo ? URL.createObjectURL(logo) : removeLogo ? null : (activity?.logoUrl ?? null)

  const setSlot = (i: number, patch: Partial<Slot>) => setSlots((ss) => ss.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  async function save() {
    setError(null)
    const valid = slots.filter((x) => x.dayIds.length)
    if (slots.length !== valid.length) return setError('Każdy termin musi mieć przynajmniej jeden dzień (albo go usuń).')
    const removed = offerings.filter((o) => !slots.some((x) => x.id === o.id))
    if (removed.length && !(await confirmAsync(`Usunąć ${removed.length === 1 ? 'termin' : `${removed.length} terminy`}? Wybory uczestników na ${removed.length === 1 ? 'niego' : 'nie'} też znikną.`))) return
    setBusy(true)
    try {
      let id = activity?.id
      if (id) await api(`/admin/activities/${id}`, { method: 'PUT', body: { name, description } })
      else id = (await api<{ id: number }>('/admin/activities', { method: 'POST', body: { name, description } })).id
      if (logo) {
        const fd = new FormData()
        fd.append('file', logo)
        await api(`/admin/activities/${id}/logo`, { method: 'PUT', body: fd })
      } else if (removeLogo) await api(`/admin/activities/${id}/logo`, { method: 'DELETE' })
      for (const o of removed) await api(`/admin/offerings/${o.id}`, { method: 'DELETE' })
      for (const { id: oid, ...slot } of slots) {
        const body: OfferingInput = { ...slot, activityId: id }
        if (oid) await api(`/admin/offerings/${oid}`, { method: 'PUT', body })
        else await api('/admin/offerings', { method: 'POST', body })
      }
      onDone()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!activity || !(await confirmAsync(`Usunąć „${activity.name}” razem z terminami i wyborami?`))) return
    await api(`/admin/activities/${activity.id}`, { method: 'DELETE' })
    onDone()
  }

  return (
    <div className="card pad form">
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <label className="logo-pick">
          {preview ? <img src={preview} alt="" /> : <span>+ logo</span>}
          <input type="file" accept="image/*" hidden onChange={(e) => { setLogo(e.target.files?.[0] ?? null); setRemoveLogo(false) }} />
        </label>
        <div style={{ flex: 1, display: 'grid', gap: 10 }}>
          <label>Nazwa<input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          {preview && <button className="small danger" style={{ justifySelf: 'start' }} onClick={() => { setLogo(null); setRemoveLogo(true) }}>usuń logo</button>}
        </div>
      </div>
      <label>Krótki opis<textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>

      <div className="h3" style={{ margin: '6px 0 0' }}>Terminy</div>
      {!camp ? (
        <div className="small muted">Najpierw ustaw obóz (zakładka Obóz), wtedy dodasz dni.</div>
      ) : (
        <>
          <div className="small muted">Kiedy i dla kogo. Kilka dni w jednym terminie = aktywność wielodniowa.</div>
          {slots.map((slot, i) => (
            <SlotEditor key={slot.id ?? `new-${i}`} camp={camp} slot={slot} onChange={(p) => setSlot(i, p)} onRemove={() => setSlots((ss) => ss.filter((_, j) => j !== i))} />
          ))}
          <button className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={() => setSlots((ss) => [...ss, emptySlot()])}>+ Dodaj termin</button>
        </>
      )}

      {error && <div className="small" style={{ color: 'var(--danger)' }}>{error}</div>}
      <div className="row">
        <button className="btn" onClick={save} disabled={!name.trim() || busy}>{busy ? 'Zapisuję…' : 'Zapisz'}</button>
        <button className="btn ghost" onClick={onDone}>Anuluj</button>
        <span className="sp" />
        {activity && <button className="btn ghost danger" onClick={remove}>Usuń</button>}
      </div>
    </div>
  )
}

function SlotEditor({ camp, slot, onChange, onRemove }: { camp: Camp; slot: Slot; onChange: (p: Partial<Slot>) => void; onRemove: () => void }) {
  const toggleDay = (d: number) => onChange({ dayIds: slot.dayIds.includes(d) ? slot.dayIds.filter((x) => x !== d) : [...slot.dayIds, d] })
  const toggleBracket = (b: Bracket) => {
    const cur = slot.brackets ?? BRACKETS
    const next = cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]
    onChange({ brackets: next.length === 0 || next.length === BRACKETS.length ? null : next })
  }
  return (
    <div className="slot">
      <div className="row">
        <span className="small muted">Dni</span>
        <span className="sp" />
        <button className="small danger" onClick={onRemove}>usuń termin</button>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {camp.days.map((d) => <button key={d.id} className={`chip ${slot.dayIds.includes(d.id) ? 'on' : ''}`} onClick={() => toggleDay(d.id)}>Dzień {d.dayNo}</button>)}
      </div>
      <div className="small muted">Dla kogo</div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {([[null, 'Wszyscy'], ['M', 'Chłopcy'], ['K', 'Dziewczyny']] as [Gender | null, string][]).map(([g, l]) => (
          <button key={l} className={`chip ${slot.gender === g ? 'on' : ''}`} onClick={() => onChange({ gender: g })}>{l}</button>
        ))}
        <span style={{ width: 6 }} />
        {BRACKETS.map((b) => <button key={b} className={`chip ${!slot.brackets || slot.brackets.includes(b) ? 'on' : ''}`} onClick={() => toggleBracket(b)}>{b}</button>)}
      </div>
      <div className="row">
        <label style={{ flex: 1 }}>Limit miejsc
          <input className="input" type="number" min={1} placeholder="bez limitu" value={slot.capacity ?? ''} onChange={(e) => onChange({ capacity: e.target.value ? Number(e.target.value) : null })} />
        </label>
        <label className="row" style={{ paddingTop: 18 }}>
          <input type="checkbox" checked={slot.highDemand} onChange={(e) => onChange({ highDemand: e.target.checked })} /> 🔥 duże zainteresowanie
        </label>
      </div>
    </div>
  )
}

// ---------------- participants
function Participants() {
  const [list, setList] = useState<ParticipantDto[]>([])
  const reload = useCallback(() => api<ParticipantDto[]>('/admin/participants').then(setList), [])
  useEffect(() => void reload(), [reload])

  async function patch(p: ParticipantDto, body: Partial<ParticipantDto>) {
    const updated = await api<ParticipantDto>(`/admin/participants/${p.id}`, { method: 'PUT', body })
    setList((l) => l.map((x) => (x.id === p.id ? updated : x)))
  }
  async function remove(p: ParticipantDto) {
    if (!(await confirmAsync(`Usunąć ${p.firstName} i wszystkie jego/jej wybory?`))) return
    await api(`/admin/participants/${p.id}`, { method: 'DELETE' })
    void reload()
  }

  return (
    <>
      <p className="pad small muted" style={{ margin: 0 }}>{list.length} osób. Każdy dołącza sam, otwierając aplikację z Telegrama.</p>
      {list.map((p) => (
        <div key={p.id} className="card pad">
          <div className="row">
            <b>{p.firstName} {p.lastName}</b>
            {p.username && <span className="small muted">@{p.username}</span>}
            <span className="sp" />
            <button className="small" style={{ color: 'var(--danger)' }} onClick={() => remove(p)}>usuń</button>
          </div>
          <div className="row" style={{ marginTop: 6, flexWrap: 'wrap' }}>
            {(['M', 'K'] as const).map((g) => <button key={g} className={`chip ${p.gender === g ? 'on' : ''}`} onClick={() => patch(p, { gender: g })}>{g === 'M' ? 'Chłopak' : 'Dziewczyna'}</button>)}
            {BRACKETS.map((b) => <button key={b} className={`chip ${p.bracket === b ? 'on' : ''}`} onClick={() => patch(p, { bracket: b })}>{b}</button>)}
            <button className={`chip ${p.isOrganizer ? 'on' : ''}`} onClick={() => patch(p, { isOrganizer: !p.isOrganizer })}>⚙️ organizator</button>
          </div>
        </div>
      ))}
    </>
  )
}
