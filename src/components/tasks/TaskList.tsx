import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, ChevronRight, Hourglass, UserRound } from 'lucide-react'
import type { Task } from '@/api'
import { useSwapTasks } from '@/queries/tasks'
import { isTaskClosed, responsibleOf } from '@/lib/tasks'
import { formatDate } from '@/lib/format'
import { useToast } from '@/components/ui/Toast'
import { DueBadge, PriorityBadge, ProgressBar, TaskStatusBadge } from './TaskUi'

interface MoveControls {
  onUp?: () => void
  onDown?: () => void
  busy: boolean
}

/** Uma linha de tarefa/subtarefa: título, situação, prazo, responsável. */
export function TaskRow({
  task: t,
  nested,
  toggle,
  move,
}: {
  task: Task
  nested?: boolean
  toggle?: { open: boolean; onToggle: () => void; count: number }
  move?: MoveControls
}) {
  const closed = isTaskClosed(t.status)
  return (
    <div className={clsx('group flex items-center gap-3 py-3 pr-4', nested ? 'pl-12' : 'pl-3')}>
      <span className="flex w-6 shrink-0 justify-center">
        {toggle && toggle.count > 0 && (
          <button
            type="button"
            onClick={toggle.onToggle}
            className="rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            aria-expanded={toggle.open}
            aria-label={toggle.open ? 'Recolher subtarefas' : 'Mostrar subtarefas'}
          >
            <ChevronRight className={clsx('size-4 transition-transform duration-200', toggle.open && 'rotate-90')} />
          </button>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          to={`/metas/tarefas/${t.id}`}
          className={clsx('block truncate text-sm font-medium hover:text-brand-700 hover:underline', closed ? 'text-ink-500' : 'text-ink-900', t.status === 'CANCELLED' && 'line-through')}
        >
          {t.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          <span className="flex items-center gap-1">
            <UserRound className="size-3" />
            {responsibleOf(t) ?? 'Sem responsável'}
          </span>
          {t.dueDate && <span className="tabular-nums">Prazo {formatDate(t.dueDate)}</span>}
          {t.openPendencies > 0 && (
            <span className="flex items-center gap-1 text-amber-700">
              <Hourglass className="size-3" />
              {t.openPendencies} pendência{t.openPendencies > 1 ? 's' : ''}
            </span>
          )}
          {toggle && toggle.count > 0 && t.progress && <ProgressBar progress={t.progress} className="w-28" />}
        </div>
      </div>
      <div className="hidden shrink-0 flex-wrap items-center justify-end gap-1.5 sm:flex">
        <PriorityBadge priority={t.priority} hideMedium />
        <DueBadge item={t} hideOk />
        <TaskStatusBadge status={t.status} />
      </div>
      {move && (
        <div className="flex shrink-0 flex-col opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <MoveButton label="Subir" disabled={!move.onUp || move.busy} onClick={move.onUp}>
            <ArrowUp className="size-3.5" />
          </MoveButton>
          <MoveButton label="Descer" disabled={!move.onDown || move.busy} onClick={move.onDown}>
            <ArrowDown className="size-3.5" />
          </MoveButton>
        </div>
      )}
    </div>
  )
}

function MoveButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-0.5 text-ink-400 transition-colors enabled:hover:bg-ink-100 enabled:hover:text-ink-800 disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/**
 * Controles de ordem para uma lista de irmãs. Só tarefas abertas mudam de lugar (fechada não é
 * editada): a troca é com a irmã aberta mais próxima, e as fechadas ficam onde estão.
 * `canMove` diz se o usuário pode alterar aquela tarefa (as duas da troca precisam permitir).
 */
function useMoveControls(siblings: Task[], canMove?: (t: Task) => boolean) {
  const toast = useToast()
  const swap = useSwapTasks()
  if (!canMove) return () => undefined

  const nearestOpen = (from: number, step: 1 | -1) => {
    for (let i = from + step; i >= 0 && i < siblings.length; i += step) {
      if (!isTaskClosed(siblings[i].status)) return siblings[i]
    }
    return undefined
  }

  const run = (moving: Task, other: Task, direction: 'up' | 'down') =>
    swap.mutate({ moving, other, direction }, { onError: (err) => toast.error(err) })

  return (t: Task, index: number): MoveControls | undefined => {
    if (isTaskClosed(t.status) || !canMove(t)) return undefined
    const up = nearestOpen(index, -1)
    const down = nearestOpen(index, 1)
    return {
      onUp: up && canMove(up) ? () => run(t, up, 'up') : undefined,
      onDown: down && canMove(down) ? () => run(t, down, 'down') : undefined,
      busy: swap.isPending,
    }
  }
}

/** Lista simples de irmãs (ex.: subtarefas na página da tarefa), com ordem opcional. */
export function TaskSiblingList({ tasks, canMove }: { tasks: Task[]; canMove?: (t: Task) => boolean }) {
  const moveFor = useMoveControls(tasks, canMove)
  return (
    <ul className="divide-y divide-ink-100">
      {tasks.map((t, i) => (
        <li key={t.id}>
          <TaskRow task={t} move={moveFor(t, i)} />
        </li>
      ))}
    </ul>
  )
}

/** Árvore da meta: tarefas na ordem definida, subtarefas recolhíveis. */
export function TaskTree({ tasks, canMove }: { tasks: Task[]; canMove?: (t: Task) => boolean }) {
  // abertas começam expandidas; fechadas, recolhidas
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(tasks.filter((t) => isTaskClosed(t.status)).map((t) => t.id)))
  const moveFor = useMoveControls(tasks, canMove)
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <ul className="divide-y divide-ink-100">
      {tasks.map((t, i) => {
        const subs = t.subtasks ?? []
        const open = !collapsed.has(t.id)
        return (
          <li key={t.id}>
            <TaskRow task={t} toggle={{ open, onToggle: () => toggle(t.id), count: subs.length }} move={moveFor(t, i)} />
            {open && subs.length > 0 && <SubtaskRows subtasks={subs} canMove={canMove} />}
          </li>
        )
      })}
    </ul>
  )
}

function SubtaskRows({ subtasks, canMove }: { subtasks: Task[]; canMove?: (t: Task) => boolean }) {
  const moveFor = useMoveControls(subtasks, canMove)
  return (
    <ul className="divide-y divide-ink-100 border-t border-ink-100 bg-ink-50/40">
      {subtasks.map((s, i) => (
        <li key={s.id}>
          <TaskRow task={s} nested move={moveFor(s, i)} />
        </li>
      ))}
    </ul>
  )
}
