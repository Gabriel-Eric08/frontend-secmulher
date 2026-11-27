import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { CornerDownRight, Hourglass, KanbanSquare, MoreHorizontal, OctagonAlert, Pause, UserRound, X } from 'lucide-react'
import type { Task, TaskFilters, TaskLevel, TaskPriority } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useGoals, useTaskOptions, useTasks } from '@/queries/tasks'
import {
  BOARD_COLUMN_LABEL,
  BOARD_COLUMNS,
  BOARD_STATUSES,
  PRIORITIES,
  PRIORITY_LABEL,
  boardColumnOf,
  boardMove,
  canTrackTask,
  responsibleOf,
  type BoardColumn,
} from '@/lib/tasks'
import { formatDate } from '@/lib/format'
import { addDays, toLocalDateTime } from '@/lib/fleet'
import { PageHeader } from '@/components/ui/Layout'
import { Button } from '@/components/ui/Button'
import { SearchInput, Select, Switch } from '@/components/ui/Form'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { DueBadge, PriorityBadge, ProgressBar } from '@/components/tasks/TaskUi'
import { TrackActionModal, UnblockModal, type TrackAction } from '@/components/tasks/TaskModals'

/** Concluídas se acumulam: a coluna mostra só as dos últimos N dias e linka para a lista completa. */
const DONE_DAYS = 30

const COLUMN_STYLE: Record<BoardColumn, { dot: string; ring: string }> = {
  todo: { dot: 'bg-ink-400', ring: 'ring-ink-300' },
  doing: { dot: 'bg-brand-500', ring: 'ring-brand-300' },
  blocked: { dot: 'bg-red-500', ring: 'ring-red-300' },
  done: { dot: 'bg-emerald-500', ring: 'ring-emerald-300' },
}

const LEVEL_LABEL: Record<TaskLevel, string> = { ALL: 'Tarefas e subtarefas', ROOT: 'Só tarefas', SUBTASK: 'Só subtarefas' }

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Ação pendente de um movimento: modal de acompanhamento ou de tirar do impedimento. */
type Pending = { taskId: string; action: TrackAction } | { taskId: string; action: 'unblock' }

export function QuadroPage() {
  const { tasksAccess: access, user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const goalId = params.get('meta') || undefined
  const responsibleName = params.get('responsavel') || undefined
  const priority = (params.get('prioridade') || undefined) as TaskPriority | undefined
  const level = (params.get('nivel') || undefined) as TaskLevel | undefined
  const mine = params.get('minhas') === '1'
  const [q, setQ] = useState(params.get('q') ?? '')
  const debouncedQ = useDebounced(q.trim())

  const setParam = (key: string, value: string | undefined) => {
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedQ) setParam('q', debouncedQ || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ])

  const filters = useMemo<TaskFilters>(
    () => ({
      status: BOARD_STATUSES,
      goalId,
      responsibleName,
      priority: priority ? [priority] : undefined,
      level: level && level !== 'ALL' ? level : undefined,
      mine: mine || undefined,
      q: debouncedQ || undefined,
      sort: 'PRIORITY',
    }),
    [goalId, responsibleName, priority, level, mine, debouncedQ],
  )

  const list = useTasks(filters, access.canRead)
  const options = useTaskOptions(goalId, access.canRead)
  // Dono da meta acompanha todas as tarefas dela: precisa do dono de cada meta para liberar o arraste
  const goals = useGoals({ open: true }, access.canRead && !access.canUpdate)
  const [dragging, setDragging] = useState<Task | null>(null)
  const [over, setOver] = useState<BoardColumn | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de metas e tarefas." />

  const rows = list.data ?? []
  const byId = new Map(rows.map((t) => [t.id, t]))
  const ownerOf = new Map((goals.data ?? []).map((g) => [g.id, g.owner?.id]))
  const canMove = (t: Task) =>
    canTrackTask(access, user?.id, t, {
      goalOwnerId: ownerOf.get(t.goal.id),
      parentResponsibleId: t.parent ? byId.get(t.parent.id)?.responsibleUser?.id : undefined,
    })

  const columns = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, [] as Task[]])) as Record<BoardColumn, Task[]>
  for (const t of rows) {
    const c = boardColumnOf(t.status)
    if (c) columns[c].push(t)
  }
  // concluídas: só as recentes, as mais novas primeiro
  const doneSince = toLocalDateTime(addDays(new Date(), -DONE_DAYS))
  const doneTotal = columns.done.length
  columns.done = columns.done.filter((t) => (t.completedAt ?? '') >= doneSince)
  columns.done.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  const hasFilters = !!(goalId || responsibleName || priority || level || mine || debouncedQ)

  const move = (t: Task, to: BoardColumn) => {
    const m = boardMove(t, to)
    switch (m.kind) {
      case 'none':
        return
      case 'blocked':
        toast.info(m.reason)
        return
      case 'unblock':
        setPending({ taskId: t.id, action: 'unblock' })
        return
      default:
        setPending({ taskId: t.id, action: m.kind })
    }
  }

  const onDrop = (e: DragEvent, to: BoardColumn) => {
    e.preventDefault()
    setOver(null)
    const t = dragging ?? byId.get(e.dataTransfer.getData('text/plain'))
    setDragging(null)
    if (t) move(t, to)
  }

  // A tarefa do modal vem sempre da lista atual: depois de retomar/resolver, o modal vê o estado novo
  const pendingTask = pending ? byId.get(pending.taskId) : undefined

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Metas', to: '/metas' }, { label: 'Quadro' }]}
        title="Quadro"
        description="Arraste os cartões entre as colunas para iniciar, travar, destravar ou concluir. Canceladas ficam fora do quadro."
      />

      <div className="card mb-4 p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <SearchInput className="xl:w-72" placeholder="Buscar por título, descrição ou responsável…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            <Select aria-label="Meta" value={goalId ?? ''} onChange={(e) => setParam('meta', e.target.value || undefined)}>
              <option value="">Todas as metas</option>
              {options.data?.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
            <Select aria-label="Responsável" value={responsibleName ?? ''} onChange={(e) => setParam('responsavel', e.target.value || undefined)}>
              <option value="">Qualquer responsável</option>
              {options.data?.responsibleNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <Select aria-label="Prioridade" value={priority ?? ''} onChange={(e) => setParam('prioridade', e.target.value || undefined)}>
              <option value="">Qualquer prioridade</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
            <Select aria-label="Nível" value={level ?? 'ALL'} onChange={(e) => setParam('nivel', e.target.value === 'ALL' ? undefined : e.target.value)}>
              {(Object.keys(LEVEL_LABEL) as TaskLevel[]).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
          <Switch checked={mine} onChange={(v) => setParam('minhas', v ? '1' : undefined)} label="Só minhas tarefas" />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="size-3.5" />}
              onClick={() => {
                setQ('')
                setParams({}, { replace: true })
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {list.isPending ? (
        <div className="card">
          <LoadingBlock />
        </div>
      ) : list.isError ? (
        <div className="card">
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={<KanbanSquare className="size-5" />} title={hasFilters ? 'Nenhuma tarefa neste filtro' : 'Nenhuma tarefa no quadro'} />
        </div>
      ) : (
        <div className={clsx('grid gap-4 md:grid-cols-2 xl:grid-cols-4 transition-opacity', list.isPlaceholderData && 'opacity-60')}>
          {BOARD_COLUMNS.map((col) => {
            const all = columns[col]
            const shown = all
            const target = dragging && boardColumnOf(dragging.status) !== col
            return (
              <section
                key={col}
                aria-label={BOARD_COLUMN_LABEL[col]}
                onDragOver={(e) => {
                  if (!dragging) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (over !== col) setOver(col)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === col ? null : o))
                }}
                onDrop={(e) => onDrop(e, col)}
                className={clsx(
                  'flex min-h-48 flex-col rounded-xl border border-ink-200 bg-ink-50/60 transition-shadow',
                  target && 'border-dashed',
                  over === col && target && `ring-2 ${COLUMN_STYLE[col].ring}`,
                )}
              >
                <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <span className={clsx('size-2 rounded-full', COLUMN_STYLE[col].dot)} aria-hidden />
                  <h2 className="text-sm font-semibold text-ink-800">{BOARD_COLUMN_LABEL[col]}</h2>
                  <span className="rounded-full bg-ink-200/70 px-1.5 text-xs text-ink-600 tabular-nums">{all.length}</span>
                  {col === 'done' && <span className="text-[11px] text-ink-400">últimos {DONE_DAYS} dias</span>}
                </header>
                <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                  {shown.map((t) => (
                    <BoardCard
                      key={t.id}
                      task={t}
                      draggable={canMove(t)}
                      dragging={dragging?.id === t.id}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', t.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDragging(t)
                      }}
                      onDragEnd={() => {
                        setDragging(null)
                        setOver(null)
                      }}
                      onMove={(to) => move(t, to)}
                      onOpen={() => navigate(`/metas/tarefas/${t.id}`)}
                    />
                  ))}
                  {shown.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-400">Nenhuma tarefa</p>}
                  {col === 'done' && doneTotal > all.length && (
                    <Link to="/metas/tarefas?ver=concluidas" className="px-2 py-1 text-center text-xs text-brand-700 hover:underline">
                      Ver as {doneTotal - all.length} concluídas antes disso
                    </Link>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {pending && pendingTask && pending.action === 'unblock' && <UnblockModal task={pendingTask} onClose={() => setPending(null)} />}
      {pending && pendingTask && pending.action !== 'unblock' && (
        <TrackActionModal target={{ kind: 'task', task: pendingTask }} action={pending.action} onClose={() => setPending(null)} />
      )}
    </>
  )
}

function BoardCard({
  task: t,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onOpen,
}: {
  task: Task
  draggable: boolean
  dragging: boolean
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
  onMove: (to: BoardColumn) => void
  onOpen: () => void
}) {
  const col = boardColumnOf(t.status)
  const BlockIcon = t.status === 'ON_HOLD' ? Pause : t.status === 'BLOCKED' ? OctagonAlert : Hourglass
  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen()}
      tabIndex={0}
      className={clsx(
        'group cursor-pointer rounded-lg border border-ink-200 bg-surface p-3 text-left shadow-xs transition-[box-shadow,opacity,transform] hover:shadow-md',
        draggable && 'active:cursor-grabbing',
        dragging && 'rotate-1 opacity-50',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-ink-900">{t.title}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-ink-500">
            {t.subtask && <CornerDownRight className="size-3 shrink-0" />}
            <span className="truncate">{t.parent ? t.parent.title : t.goal.title}</span>
          </p>
        </div>
        {draggable && (
          // alternativa ao arraste (teclado e celular)
          <div onClick={(e) => e.stopPropagation()} className="-mt-1 -mr-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100">
            <MoveMenu current={col} onMove={onMove} />
          </div>
        )}
      </div>

      {col === 'blocked' && (
        <p className={clsx('mt-2 flex items-center gap-1 text-xs font-medium', t.status === 'BLOCKED' ? 'text-red-700' : 'text-amber-700')}>
          <BlockIcon className="size-3.5" />
          {t.statusLabel}
          {t.openPendencies > 1 && ` · ${t.openPendencies} pendências`}
        </p>
      )}

      {t.progress && t.progress.total > 0 && <ProgressBar progress={t.progress} className="mt-2" />}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={t.priority} hideMedium />
        {col !== 'done' && <DueBadge item={t} hideOk />}
        {col !== 'done' && t.dueDate && t.deadlineStatus === 'OK' && <span className="text-[11px] text-ink-500 tabular-nums">até {formatDate(t.dueDate)}</span>}
        {col === 'done' && t.completedAt && <span className="text-[11px] text-ink-500 tabular-nums">concluída em {formatDate(t.completedAt)}</span>}
      </div>

      <p className="mt-2 flex items-center gap-1 truncate text-xs text-ink-600">
        <UserRound className="size-3 shrink-0 text-ink-400" />
        <span className="truncate">{responsibleOf(t) ?? 'Sem responsável'}</span>
      </p>
    </article>
  )
}

/** Menu compacto "Mover para…": alternativa ao arraste no teclado e no celular. */
function MoveMenu({ current, onMove }: { current: BoardColumn | null; onMove: (to: BoardColumn) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Mover para…"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-48 rounded-lg border border-ink-200 bg-surface py-1 shadow-(--shadow-pop) animate-fade-in">
          {BOARD_COLUMNS.filter((c) => c !== current).map((c) => (
            <button
              key={c}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onMove(c)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-700 hover:bg-ink-100"
            >
              <span className={clsx('size-2 rounded-full', COLUMN_STYLE[c].dot)} aria-hidden />
              Mover para {BOARD_COLUMN_LABEL[c]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
