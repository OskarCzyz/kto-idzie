import { useCallback, useEffect, useState } from 'react'
import type { Activity, Camp, CampInput, OfferingDto, OfferingInput, ParticipantDto } from '../shared/api'
import type { Bracket, Gender } from '../domain'
import { api } from './api'
import { confirmAsync } from './telegram'

const BRACKETS: Bracket[] = ['U15', 'U18', 'O18']
type Tab = 'camp' | 'activities' | 'offerings' | 'participants'
const TABS: [Tab, string][] = [['camp', 'Obóz'], ['activities', 'Aktywności'], ['offerings', 'Oferty'], ['participants', 'Uczestnicy']]

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
      {tab === 'activities' && <Activities activities={activities} reload={reloadActivities} />}
      {tab === 'offerings' && (camp ? <Offerings camp={camp} activities={activities} /> : <p className="pad muted">Najpierw ustaw obóz.</p>)}
      {tab === 'participants' && <Participants />}
    </div>
  )
}

// ---------------- camp
function CampForm({ camp, onSaved }: { camp: Camp | null; onSaved: (c: Camp) => void }) {
  const [form, setForm] = useState<CampInput>({ name: '', days: [1, 2, 3].map((n) => ({ dayNo: n, date: null })), waves: {} })
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (camp) setForm({ name: camp.name, days: camp.days.map((d) => ({ dayNo: d.dayNo, date: d.date })), waves: camp.waves })
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
      <div className="h3" style={{ margin: '10px 0 4px' }}>Start zapisów (fale)</div>
      {BRACKETS.map((b) => (
        <label key={b}>{b}
          <input className="input" type="date" value={form.waves[b] ?? ''} onChange={(e) => setForm({ ...form, waves: { ...form.waves, [b]: e.target.value || undefined } })} />
        </label>
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

// ---------------- activities
function Activities({ activities, reload }: { activities: Activity[]; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  return (
    <>
      <div className="pad"><button className="btn" onClick={() => setEditing('new')}>+ Nowa aktywność</button></div>
      {editing === 'new' && <ActivityForm onDone={() => { setEditing(null); void reload() }} />}
      {activities.map((a) =>
        editing === a.id ? (
          <ActivityForm key={a.id} activity={a} onDone={() => { setEditing(null); void reload() }} />
        ) : (
          <div key={a.id} className="card pad row" onClick={() => setEditing(a.id)} style={{ cursor: 'pointer' }}>
            {a.photos[0] ? <img src={a.photos[0].url} className="thumb" alt="" /> : <div className="thumb" />}
            <div style={{ minWidth: 0 }}>
              <div className="b">{a.name}</div>
              <div className="small muted ellipsis">{a.description || '—'}</div>
            </div>
          </div>
        ),
      )}
    </>
  )
}

function ActivityForm({ activity, onDone }: { activity?: Activity; onDone: () => void }) {
  const [name, setName] = useState(activity?.name ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [photos, setPhotos] = useState(activity?.photos ?? [])
  const [busy, setBusy] = useState(false)

  async function save() {
    if (activity) await api(`/admin/activities/${activity.id}`, { method: 'PUT', body: { name, description } })
    else await api('/admin/activities', { method: 'POST', body: { name, description } })
    onDone()
  }
  async function upload(files: FileList | null) {
    if (!activity || !files) return
    setBusy(true)
    try {
      for (const file of files) {
        const fd = new FormData()
        fd.append('file', file)
        await api(`/admin/activities/${activity.id}/photos`, { method: 'POST', body: fd })
      }
      const fresh = (await api<Activity[]>('/admin/activities')).find((a) => a.id === activity.id)
      setPhotos(fresh?.photos ?? [])
    } finally {
      setBusy(false)
    }
  }
  async function removePhoto(id: number) {
    await api(`/admin/photos/${id}`, { method: 'DELETE' })
    setPhotos((p) => p.filter((x) => x.id !== id))
  }
  async function remove() {
    if (!activity || !(await confirmAsync(`Usunąć „${activity.name}” razem z jej ofertami i wyborami?`))) return
    await api(`/admin/activities/${activity.id}`, { method: 'DELETE' })
    onDone()
  }

  return (
    <div className="card pad form">
      <label>Nazwa<input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Krótki opis<textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {activity ? (
        <div>
          <div className="small muted">Zdjęcia</div>
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
                <img src={p.url} className="thumb" alt="" />
                <button className="thumb-x" onClick={() => removePhoto(p.id)}>✕</button>
              </div>
            ))}
            <label className="thumb add">{busy ? '…' : '+'}<input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} /></label>
          </div>
        </div>
      ) : (
        <div className="small muted">Zdjęcia dodasz po zapisaniu.</div>
      )}
      <div className="row">
        <button className="btn" onClick={save} disabled={!name.trim()}>Zapisz</button>
        <button className="btn ghost" onClick={onDone}>Anuluj</button>
        <span className="sp" />
        {activity && <button className="btn ghost danger" onClick={remove}>Usuń</button>}
      </div>
    </div>
  )
}

// ---------------- offerings
const emptyOffering = (activityId: number): OfferingInput => ({ activityId, dayIds: [], gender: null, brackets: null, capacity: null, highDemand: false })

function Offerings({ camp, activities }: { camp: Camp; activities: Activity[] }) {
  const [offerings, setOfferings] = useState<OfferingDto[]>([])
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const reload = useCallback(() => api<OfferingDto[]>('/admin/offerings').then(setOfferings), [])
  useEffect(() => void reload(), [reload])
  const actName = (id: number) => activities.find((a) => a.id === id)?.name ?? '?'
  const dayNo = (id: number) => camp.days.find((d) => d.id === id)?.dayNo
  const done = () => { setEditing(null); void reload() }

  if (!activities.length) return <p className="pad muted">Najpierw dodaj aktywności.</p>
  return (
    <>
      <div className="pad"><button className="btn" onClick={() => setEditing('new')}>+ Nowa oferta</button></div>
      {editing === 'new' && <OfferingForm camp={camp} activities={activities} initial={emptyOffering(activities[0]!.id)} onDone={done} />}
      {camp.days.map((d) => {
        const list = offerings.filter((o) => o.dayIds[0] === d.id)
        if (!list.length) return null
        return (
          <div key={d.id}>
            <div className="h3">Zaczyna się w dniu {d.dayNo}</div>
            {list.map((o) =>
              editing === o.id ? (
                <OfferingForm key={o.id} camp={camp} activities={activities} initial={o} id={o.id} onDone={done} />
              ) : (
                <div key={o.id} className="card pad" onClick={() => setEditing(o.id)} style={{ cursor: 'pointer' }}>
                  <div className="b">{actName(o.activityId)} {o.highDemand && '🔥'}</div>
                  <div className="small muted">
                    {[
                      'dni ' + o.dayIds.map(dayNo).join(', '),
                      o.gender === 'K' ? 'tylko dziewczyny' : o.gender === 'M' ? 'tylko chłopcy' : '',
                      o.brackets?.join('/') ?? '',
                      o.capacity ? `max ${o.capacity}` : 'bez limitu',
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
              ),
            )}
          </div>
        )
      })}
    </>
  )
}

function OfferingForm({ camp, activities, initial, id, onDone }: { camp: Camp; activities: Activity[]; initial: OfferingInput; id?: number; onDone: () => void }) {
  const [f, setF] = useState<OfferingInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const toggleDay = (d: number) => setF({ ...f, dayIds: f.dayIds.includes(d) ? f.dayIds.filter((x) => x !== d) : [...f.dayIds, d] })
  const toggleBracket = (b: Bracket) => {
    const cur = f.brackets ?? []
    const next = cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]
    setF({ ...f, brackets: next.length === 0 || next.length === BRACKETS.length ? null : next })
  }

  async function save() {
    setError(null)
    try {
      if (id) await api(`/admin/offerings/${id}`, { method: 'PUT', body: f })
      else await api('/admin/offerings', { method: 'POST', body: f })
      onDone()
    } catch (e) {
      setError(String(e))
    }
  }
  async function remove() {
    if (!id || !(await confirmAsync('Usunąć ofertę razem z wyborami uczestników?'))) return
    await api(`/admin/offerings/${id}`, { method: 'DELETE' })
    onDone()
  }

  return (
    <div className="card pad form">
      <label>Aktywność
        <select className="input" value={f.activityId} onChange={(e) => setF({ ...f, activityId: Number(e.target.value) })}>
          {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <div>
        <div className="small muted">Dni (kilka = aktywność wielodniowa)</div>
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
          {camp.days.map((d) => <button key={d.id} className={`chip ${f.dayIds.includes(d.id) ? 'on' : ''}`} onClick={() => toggleDay(d.id)}>Dzień {d.dayNo}</button>)}
        </div>
      </div>
      <div>
        <div className="small muted">Dla kogo</div>
        <div className="row" style={{ marginTop: 4 }}>
          {([[null, 'Wszyscy'], ['M', 'Chłopcy'], ['K', 'Dziewczyny']] as [Gender | null, string][]).map(([g, l]) => (
            <button key={l} className={`chip ${f.gender === g ? 'on' : ''}`} onClick={() => setF({ ...f, gender: g })}>{l}</button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          {BRACKETS.map((b) => <button key={b} className={`chip ${!f.brackets || f.brackets.includes(b) ? 'on' : ''}`} onClick={() => toggleBracket(b)}>{b}</button>)}
        </div>
      </div>
      <label>Limit miejsc (puste = bez limitu)
        <input className="input" type="number" min={1} value={f.capacity ?? ''} onChange={(e) => setF({ ...f, capacity: e.target.value ? Number(e.target.value) : null })} />
      </label>
      <label className="row"><input type="checkbox" checked={f.highDemand} onChange={(e) => setF({ ...f, highDemand: e.target.checked })} /> 🔥 Duże zainteresowanie</label>
      {error && <div className="small" style={{ color: 'var(--danger)' }}>{error}</div>}
      <div className="row">
        <button className="btn" onClick={save} disabled={!f.dayIds.length}>Zapisz</button>
        <button className="btn ghost" onClick={onDone}>Anuluj</button>
        <span className="sp" />
        {id && <button className="btn ghost danger" onClick={remove}>Usuń</button>}
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
