import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { movePick, removePick, type Plan } from '../domain'
import { GoersLine, ConditionLine } from './parts'
import { tg } from './telegram'
import { Thumb } from './ui'
import type { Filter, View } from './view'

export interface RankingProps {
  view: View
  day: number
  filter: Filter
  edit: (change: (plan: Plan) => Plan) => void
  openOffering: (oid: number) => void
  openCondition: (oid: number) => void
}

/** My ranking for one day: drag by the handle (or use ▲▼) to reorder. */
export function Ranking(props: RankingProps) {
  const { view, day, edit } = props
  const ranking = view.myPlan.rankings[day] ?? []
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const move = (from: number, to: number) => edit((p) => movePick(p, day, from, to))

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    move(ranking.indexOf(Number(e.active.id)), ranking.indexOf(Number(e.over.id)))
  }

  if (!ranking.length)
    return <div className="card pad muted small">Pusto. Dodaj opcje, o których myślisz – potem ułożysz je od najbardziej chcianej.</div>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => tg?.HapticFeedback?.selectionChanged()} onDragEnd={onDragEnd}>
      <SortableContext items={ranking} strategy={verticalListSortingStrategy}>
        <div className="rank">
          {ranking.map((oid, i) => (
            <RankItem key={oid} {...props} oid={oid} index={i} count={ranking.length} move={move} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function RankItem({ view, day, filter, edit, openOffering, openCondition, oid, index, count, move }: RankingProps & { oid: number; index: number; count: number; move: (from: number, to: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: oid })
  const me = view.me.id
  const offering = view.offering(oid)
  const activity = view.activityOf(oid)
  const current = view.res.currentChoice(me, day)
  const ranking = view.myPlan.rankings[day] ?? []
  const isCurrent = current === oid
  const isConflict = view.res.conflicts(me).includes(oid)
  const condition = view.myPlan.conditions[oid]

  let reason = ''
  if (isCurrent) reason = '← obecny wybór'
  else if (isConflict) reason = '⚠️ konflikt dni'
  else if (condition && !view.res.conditionMet(me, oid, day)) reason = ''
  else if (current != null && ranking.indexOf(current) < index) reason = 'wyżej jest coś, co się udaje'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`ri ${isCurrent ? 'cur' : 'off'} ${isDragging ? 'dragging' : ''}`}
    >
      <span className="handle" {...attributes} {...listeners} aria-label="Przeciągnij">⠿</span>
      <div className="n">{index + 1}</div>
      <Thumb activity={activity} size={36} />
      <div className="body" style={{ flex: 1, minWidth: 0 }}>
        <div className="b" onClick={() => openOffering(oid)} style={{ cursor: 'pointer' }}>
          {activity.name} {view.daysText(offering) && <span className="badge">{view.daysText(offering)}</span>}
        </div>
        {condition && <ConditionLine view={view} pid={me} oid={oid} day={day} />}
        <GoersLine view={view} oid={oid} day={day} filter={filter} />
        {reason && <div className="small" style={{ marginTop: 3, color: isCurrent ? 'var(--accent)' : isConflict ? 'var(--wait)' : 'var(--muted)', fontWeight: isCurrent ? 600 : 400 }}>{reason}</div>}
        <div style={{ marginTop: 4 }}>
          <button className="linkb" onClick={() => openCondition(oid)}>{condition ? 'zmień warunek' : '+ warunek'}</button>
          {' · '}
          <button className="linkb" style={{ color: 'var(--danger)' }} onClick={() => edit((p) => removePick(p, view.domainOffering(oid)))}>usuń</button>
        </div>
      </div>
      <div className="mv">
        <button disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="Wyżej">▲</button>
        <button disabled={index === count - 1} onClick={() => move(index, index + 1)} aria-label="Niżej">▼</button>
      </div>
    </div>
  )
}
