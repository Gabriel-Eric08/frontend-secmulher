import { Link } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowRight,
  Ban,
  CalendarClock,
  CheckCircle2,
  FileEdit,
  Flag,
  Hourglass,
  MessageSquarePlus,
  NotebookPen,
  OctagonAlert,
  Pause,
  Pencil,
  Play,
  RotateCcw,
} from 'lucide-react'
import type { TaskActivity, TaskActivityKind, TaskDeadlineStatus, TaskGoalStatus, TaskPendencyKind, TaskPriority, TaskProgress, TaskStatus } from '@/api'
import {
  ACTIVITY_KIND_TONE,
  GOAL_STATUS_LABEL,
  GOAL_STATUS_TONE,
  PENDENCY_KIND_LABEL,
  PENDENCY_KIND_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
  dueInfo,
  statusLabelOf,
  taskFieldLabel,
} from '@/lib/tasks'
import { formatDateTimeLocal } from '@/lib/fleet'
import { formatDate, formatValue } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'

export function GoalStatusBadge({ status }: { status: TaskGoalStatus }) {
  return <Badge tone={GOAL_STATUS_TONE[status]}>{GOAL_STATUS_LABEL[status]}</Badge>
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={TASK_STATUS_TONE[status]}>{TASK_STATUS_LABEL[status]}</Badge>
}

export function PriorityBadge({ priority, hideMedium }: { priority: TaskPriority; hideMedium?: boolean }) {
  if (hideMedium && priority === 'MEDIUM') return null
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>
}

export function PendencyKindBadge({ kind }: { kind: TaskPendencyKind }) {
  const Icon = kind === 'IMPEDIMENT' ? OctagonAlert : Hourglass
  return (
    <Badge tone={PENDENCY_KIND_TONE[kind]} icon={<Icon className="size-3" />}>
      {PENDENCY_KIND_LABEL[kind]}
    </Badge>
  )
}

/** Prazo; nada quando não há prazo ou está fechada. `hideOk` esconde o "faltam N dias" em listas. */
export function DueBadge({ item, hideOk }: { item: { deadlineStatus: TaskDeadlineStatus; daysToDue: number | null }; hideOk?: boolean }) {
  const info = dueInfo(item)
  if (!info || (hideOk && item.deadlineStatus === 'OK')) return null
  return (
    <Badge tone={info.tone} icon={<CalendarClock className="size-3" />}>
      {info.label}
    </Badge>
  )
}

/** Barra de progresso: concluídas ÷ não canceladas. */
export function ProgressBar({ progress, className, showLabel = true }: { progress: TaskProgress | null; className?: string; showLabel?: boolean }) {
  if (!progress) return null
  const pct = progress.percent
  const counted = progress.total - progress.cancelled
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? 0}
      >
        <div
          className={clsx('h-full rounded-full transition-[width] duration-500', pct === 100 ? 'bg-emerald-500' : 'bg-brand-500')}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      {showLabel && (
        <span className="shrink-0 text-xs text-ink-500 tabular-nums" title={`${progress.completed} de ${counted} concluída(s)`}>
          {pct == null ? '—' : `${progress.completed}/${counted}`}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Histórico

function changeValue(key: string, v: unknown): string {
  if (v == null || v === '') return '—'
  if (key === 'status' && typeof v === 'string') return statusLabelOf(v) ?? v
  if (key === 'priority' && typeof v === 'string' && v in PRIORITY_LABEL) return PRIORITY_LABEL[v as TaskPriority]
  if ((key === 'startDate' || key === 'dueDate') && typeof v === 'string') return formatDate(v)
  return formatValue(v)
}

function isChange(v: unknown): v is { antigo?: unknown; novo?: unknown } {
  return !!v && typeof v === 'object' && ('antigo' in v || 'novo' in v)
}

export function TaskChanges({ changes }: { changes: Record<string, unknown> | null }) {
  const entries = changes ? Object.entries(changes) : []
  if (entries.length === 0) return null
  return (
    <dl className="mt-2 divide-y divide-ink-100 rounded-md border border-ink-200 bg-surface text-xs">
      {entries.map(([key, v]) => (
        <div key={key} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 px-3 py-1.5">
          <dt className="truncate font-medium text-ink-600">{taskFieldLabel(key)}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
            {isChange(v) ? (
              <>
                <span className="break-words text-ink-400 line-through decoration-ink-300">{changeValue(key, v.antigo)}</span>
                <ArrowRight className="size-3 shrink-0 text-ink-400" />
                <span className="break-words font-medium text-ink-800">{changeValue(key, v.novo)}</span>
              </>
            ) : (
              <span className="text-ink-700">{changeValue(key, v)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const ACTIVITY_ICON: Record<TaskActivityKind, typeof Flag> = {
  CREATED: FileEdit,
  FIELD_UPDATE: Pencil,
  NOTE: MessageSquarePlus,
  STARTED: Play,
  PENDENCY_OPENED: OctagonAlert,
  PENDENCY_RESOLVED: CheckCircle2,
  PUT_ON_HOLD: Pause,
  RESUMED: Play,
  COMPLETED: Flag,
  REOPENED: RotateCcw,
  CANCELLED: Ban,
}

const ICON_STYLE: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-700',
  neutral: 'bg-ink-100 text-ink-500',
  warning: 'bg-amber-50 text-amber-700',
  success: 'bg-emerald-50 text-emerald-700',
  danger: 'bg-red-50 text-red-600',
}

/**
 * Histórico (mais recente primeiro). `currentTaskId` evita linkar a própria tarefa;
 * eventos de outras tarefas/subtarefas mostram de qual vieram.
 */
export function TaskTimeline({
  items,
  loading,
  error,
  onRetry,
  currentTaskId,
}: {
  items: TaskActivity[] | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  currentTaskId?: string
}) {
  if (loading) return <div className="card"><LoadingBlock /></div>
  if (error) return <div className="card"><ErrorState error={error} onRetry={onRetry} /></div>
  if (!items || items.length === 0) return <div className="card"><EmptyState title="Sem registros" /></div>

  return (
    <div className="card p-5 animate-fade-in">
      <ol className="relative space-y-5">
        <span className="absolute top-3 bottom-3 left-[15px] w-px bg-ink-200" aria-hidden />
        {items.map((it) => (
          <TimelineItem key={it.id} activity={it} currentTaskId={currentTaskId} />
        ))}
      </ol>
    </div>
  )
}

function TimelineItem({ activity: it, currentTaskId }: { activity: TaskActivity; currentTaskId?: string }) {
  const Icon = ACTIVITY_ICON[it.kind] ?? NotebookPen
  const tone = ACTIVITY_KIND_TONE[it.kind] ?? 'neutral'
  const backdated = it.occurredAt.slice(0, 16) !== it.createdAt.slice(0, 16)
  return (
    <li className="relative flex gap-3">
      <span className={clsx('relative flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface', ICON_STYLE[tone])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-ink-900">{it.kindLabel}</span>
          {it.task && it.task.id !== currentTaskId && (
            <Link to={`/metas/tarefas/${it.task.id}`} className="max-w-[18rem] truncate text-xs text-brand-700 hover:underline">
              {it.subtask ? 'Subtarefa' : 'Tarefa'}: {it.task.title}
            </Link>
          )}
          <span className="text-xs text-ink-500 tabular-nums">{formatDateTimeLocal(it.occurredAt)}</span>
          {it.user && <span className="text-xs text-ink-500">· {it.user.name}</span>}
          {backdated && (
            <span className="text-[11px] text-ink-400" title="Data informada diferente do momento do registro">
              (registrado em {formatDateTimeLocal(it.createdAt)})
            </span>
          )}
        </p>
        {it.description && <p className="mt-1 text-sm whitespace-pre-line text-ink-700">{it.description}</p>}
        <TaskChanges changes={it.changes} />
      </div>
    </li>
  )
}
