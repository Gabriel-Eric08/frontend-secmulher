import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, ChevronRight, Hourglass } from 'lucide-react'
import type { Task, TaskPriority, TaskStatus, UUID } from '@/api'
import { useGoal, useTasks } from '@/queries/tasks'
import { boardColumnOf, isTaskClosed, responsibleOf, TASK_STATUS_LABEL } from '@/lib/tasks'
import { formatDate } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

/** Cor da situação: a mesma coluna do quadro; canceladas em cinza. */
function statusColor(status: TaskStatus): string {
  const col = boardColumnOf(status)
  return col ? `var(--chart-${col})` : 'var(--color-ink-300)'
}

/** Abertas primeiro; dentro delas, o maior atraso / prazo mais próximo primeiro; sem prazo por último. */
function byUrgency(a: Task, b: Task): number {
  const ca = isTaskClosed(a.status) ? 1 : 0
  const cb = isTaskClosed(b.status) ? 1 : 0
  if (ca !== cb) return ca - cb
  return (a.daysToDue ?? Number.POSITIVE_INFINITY) - (b.daysToDue ?? Number.POSITIVE_INFINITY)
}

const delayOf = (t: Task) => (t.deadlineStatus === 'OVERDUE' && t.daysToDue != null ? -t.daysToDue : 0)

/** Prazo em texto, só com cor quando pede atenção. */
function DueText({ task: t }: { task: Task }) {
  if (t.status === 'COMPLETED') return <span className="text-ink-400">{t.completedAt ? `Concluída ${formatDate(t.completedAt)}` : 'Concluída'}</span>
  if (t.status === 'CANCELLED') return <span className="text-ink-400">Cancelada</span>
  const d = t.daysToDue
  if (t.deadlineStatus === 'OVERDUE') return <span className="font-medium text-red-600">{d != null ? `${plural(-d, 'dia', 'dias')} de atraso` : 'Atrasada'}</span>
  if (t.deadlineStatus === 'NEAR') return <span className="font-medium text-amber-700">{d === 0 ? 'Vence hoje' : `Vence em ${plural(d ?? 0, 'dia', 'dias')}`}</span>
  if (t.dueDate) return <span className="text-ink-500 tabular-nums">{formatDate(t.dueDate)}</span>
  return <span className="text-ink-400">Sem prazo</span>
}

/**
 * Uma linha por tarefa: bolinha da situação, título e, abaixo, situação · contexto.
 * À direita, o prazo. O resto (prioridade, pendências, histórico) fica na página da tarefa.
 */
function SimpleTaskRow({ task: t, context }: { task: Task; context: 'goal' | 'responsible' }) {
  const closed = isTaskClosed(t.status)
  const ctx = context === 'goal' ? t.goal.title : (responsibleOf(t) ?? 'Sem responsável')
  return (
    <li>
      <Link to={`/metas/tarefas/${t.id}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-ink-100">
        <span className="size-2 shrink-0 rounded-full" style={{ background: statusColor(t.status) }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={clsx('block truncate text-sm', closed ? 'text-ink-500' : 'font-medium text-ink-900', t.status === 'CANCELLED' && 'line-through')}>
            {t.subtask && <span className="text-ink-400">↳ </span>}
            {t.title}
          </span>
          <span className="flex items-center gap-1.5 truncate text-xs text-ink-500">
            {TASK_STATUS_LABEL[t.status]} · {ctx}
            {!closed && t.openPendencies > 0 && (
              <span className="inline-flex items-center gap-0.5 text-amber-700" title={plural(t.openPendencies, 'pendência aberta', 'pendências abertas')}>
                · <Hourglass className="size-3" />
                {t.openPendencies}
              </span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs">
          <DueText task={t} />
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-300 transition-colors group-hover:text-ink-500" aria-hidden />
      </Link>
    </li>
  )
}

// ---------------------------------------------------------------- Modal do responsável

type View = 'open' | 'overdue' | 'closed'

/**
 * Tarefas de um responsável dentro do recorte atual da visão geral (meta, prioridade, "só minhas"):
 * três números (abertas, atrasadas e o maior atraso, concluídas) e a lista por abas.
 */
export function ResponsibleTasksModal({
  name,
  onClose,
  goalId,
  priority,
  mine,
  listLink,
}: {
  name: string | null
  onClose: () => void
  goalId?: UUID
  priority?: TaskPriority
  mine?: boolean
  listLink: (extra: Record<string, string>) => string
}) {
  const [view, setView] = useState<View>('open')
  const list = useTasks(
    { responsibleName: name ?? undefined, goalId, priority: priority ? [priority] : undefined, mine: mine || undefined, level: 'ALL', sort: 'DUE_DATE' },
    !!name,
  )
  // a lista anterior fica como placeholder: ignora enquanto for de outra pessoa
  const tasks = useMemo(() => (list.isPlaceholderData ? [] : [...(list.data ?? [])].sort(byUrgency)), [list.data, list.isPlaceholderData])

  const open = tasks.filter((t) => !isTaskClosed(t.status))
  const overdue = open.filter((t) => t.deadlineStatus === 'OVERDUE')
  const closed = tasks.filter((t) => isTaskClosed(t.status))
  const completed = closed.filter((t) => t.status === 'COMPLETED').length
  const worstDelay = Math.max(0, ...overdue.map(delayOf))
  const counted = tasks.length - (closed.length - completed)
  const percent = counted > 0 ? Math.round((completed / counted) * 100) : null

  const shown = view === 'open' ? open : view === 'overdue' ? overdue : closed
  const tabs: { key: View; label: string; count: number }[] = [
    { key: 'open', label: 'Abertas', count: open.length },
    { key: 'overdue', label: 'Atrasadas', count: overdue.length },
    { key: 'closed', label: 'Encerradas', count: closed.length },
  ]

  const close = () => {
    setView('open')
    onClose()
  }

  return (
    <Modal
      open={!!name}
      onClose={close}
      title={name ?? ''}
      size="lg"
      footer={
        name && (
          <Link to={listLink({ responsavel: name })} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            Abrir na lista de tarefas <ArrowRight className="size-4" />
          </Link>
        )
      }
    >
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isLoading || list.isPlaceholderData ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-3 divide-x divide-ink-100 rounded-xl border border-ink-200 text-center">
            <div className="p-3">
              <dt className="text-xs text-ink-500">Abertas</dt>
              <dd className="text-xl font-semibold text-ink-900 tabular-nums">{open.length}</dd>
            </div>
            <div className="p-3">
              <dt className="text-xs text-ink-500">Atrasadas</dt>
              <dd className={clsx('text-xl font-semibold tabular-nums', overdue.length ? 'text-red-600' : 'text-ink-900')}>{overdue.length}</dd>
              {overdue.length > 0 && <dd className="text-[11px] text-ink-500">até {plural(worstDelay, 'dia', 'dias')}</dd>}
            </div>
            <div className="p-3">
              <dt className="text-xs text-ink-500">Concluídas</dt>
              <dd className="text-xl font-semibold text-ink-900 tabular-nums">{percent == null ? '—' : `${percent}%`}</dd>
            </div>
          </dl>

          <div className="flex gap-1 border-b border-ink-100" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={view === t.key}
                onClick={() => setView(t.key)}
                className={clsx(
                  '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
                  view === t.key ? 'border-brand-600 font-medium text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-800',
                )}
              >
                {t.label} <span className="text-ink-400 tabular-nums">{t.count}</span>
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">{view === 'overdue' ? 'Nenhuma tarefa em atraso.' : 'Nenhuma tarefa aqui.'}</p>
          ) : (
            <ul>
              {shown.map((t) => (
                <SimpleTaskRow key={t.id} task={t} context="goal" />
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------- Detalhe da meta (acordeão)

/** Quantas tarefas a meta mostra antes de "ver todas". */
const GOAL_PREVIEW = 5

/** Detalhes de uma meta aberta na lista "Andamento por meta": uma linha de dados e as tarefas mais urgentes. */
export function GoalDetailPanel({ goalId }: { goalId: UUID }) {
  const detail = useGoal(goalId)
  const [all, setAll] = useState(false)

  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
  if (!detail.data) return <LoadingBlock />

  const { goal: g, tasks } = detail.data
  const flat = tasks.flatMap((t) => [t, ...(t.subtasks ?? [])]).sort(byUrgency)
  const shown = all ? flat : flat.slice(0, GOAL_PREVIEW)
  const facts = [g.statusLabel, g.owner ? `Dono: ${g.owner.name}` : null, g.dueDate ? `Prazo ${formatDate(g.dueDate)}` : 'Sem prazo'].filter(Boolean)

  return (
    <div className="space-y-2 text-xs">
      <p className="text-ink-500">
        {facts.join(' · ')}
        {g.deadlineStatus === 'OVERDUE' && g.daysToDue != null && <span className="font-medium text-red-600"> · {plural(-g.daysToDue, 'dia', 'dias')} de atraso</span>}
      </p>

      {flat.length === 0 ? (
        <p className="py-2 text-ink-400">Esta meta ainda não tem tarefas.</p>
      ) : (
        <ul>
          {shown.map((t) => (
            <SimpleTaskRow key={t.id} task={t} context="responsible" />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        {flat.length > GOAL_PREVIEW ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="text-brand-700 hover:underline">
            {all ? 'Mostrar menos' : `Ver todas (${flat.length})`}
          </button>
        ) : (
          <span />
        )}
        <Link to={`/metas/${g.id}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
          Abrir meta <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}
