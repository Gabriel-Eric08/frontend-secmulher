import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleCheck,
  Flag,
  Hourglass,
  ListTodo,
  MessageSquarePlus,
  NotebookPen,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { Crumb } from '@/components/ui/Layout'
import type { Task, TaskPendency } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useDeleteTask, useGoal, useTask, useTaskPendencies, useTaskTimeline } from '@/queries/tasks'
import { canCreateSubtask, canTrackTask, daysLabel, findTask, idleLabel, isGoalClosed, isTaskClosed, responsibleOf } from '@/lib/tasks'
import { formatDateTimeLocal } from '@/lib/fleet'
import { formatDate } from '@/lib/format'
import { Card, PageHeader, Tabs } from '@/components/ui/Layout'
import { Button } from '@/components/ui/Button'
import { MenuButton } from '@/components/ui/Menu'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock, PageSkeleton } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { DueBadge, PendencyKindBadge, PriorityBadge, ProgressBar, TaskStatusBadge, TaskTimeline } from '@/components/tasks/TaskUi'
import { TaskSiblingList } from '@/components/tasks/TaskList'
import { ResolveTaskPendencyModal, TaskFormModal, TrackActionModal, type TrackAction } from '@/components/tasks/TaskModals'

type Tab = 'detalhes' | 'pendencias' | 'historico'

export function TarefaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const { tasksAccess: access, user } = useAuth()
  const task = useTask(access.canRead ? id : undefined)
  // A meta traz o dono e a árvore (responsável pela tarefa-mãe): base das permissões de quem acompanha
  const goal = useGoal(task.data?.goal.id)
  const pendencies = useTaskPendencies(access.canRead ? id : undefined)
  const timeline = useTaskTimeline(access.canRead ? id : undefined)
  const del = useDeleteTask()
  const [tab, setTab] = useState<Tab>('detalhes')
  const [action, setAction] = useState<TrackAction | null>(null)
  const [editing, setEditing] = useState(false)
  const [addingSub, setAddingSub] = useState(false)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de metas e tarefas." />
  if (task.isPending) return <PageSkeleton />
  if (task.isError) return <ErrorState error={task.error} onRetry={() => task.refetch()} />

  const t = task.data
  const noun = t.subtask ? 'subtarefa' : 'tarefa'
  const closed = isTaskClosed(t.status)
  const parentTask = findTask(goal.data?.tasks, t.parent?.id)
  const ctx = { goalOwnerId: goal.data?.goal.owner?.id, parentResponsibleId: parentTask?.responsibleUser?.id }
  const track = canTrackTask(access, user?.id, t, ctx)
  const canAddSub = !t.subtask && !closed && canCreateSubtask(access, user?.id, t, ctx)
  const openCount = (pendencies.data ?? []).filter((p) => p.open).length

  // Reabrir exige a meta aberta (tarefa) ou a tarefa-mãe aberta (subtarefa)
  const reopenBlocked = t.subtask
    ? !!t.parent && isTaskClosed(t.parent.status)
      ? 'Reabra a tarefa-mãe antes.'
      : null
    : isGoalClosed(t.goal.status)
      ? 'Reabra a meta antes.'
      : null

  const onDelete = async () => {
    const ok = await confirm({
      title: `Excluir ${noun}`,
      message: (
        <>
          <strong>{t.title}</strong> será excluída{t.subtask ? '' : ' com as subtarefas'}, pendências e histórico. Não é possível desfazer.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(t.id)
      toast.success(`${t.subtask ? 'Subtarefa' : 'Tarefa'} excluída.`)
      navigate(t.parent ? `/metas/tarefas/${t.parent.id}` : `/metas/${t.goal.id}`)
    } catch (err) {
      toast.error(err)
    }
  }

  const crumbs: Crumb[] = [
    { label: 'Metas', to: '/metas' },
    { label: t.goal.title, to: `/metas/${t.goal.id}` },
    ...(t.parent ? [{ label: t.parent.title, to: `/metas/tarefas/${t.parent.id}` }] : []),
    { label: t.title },
  ]

  return (
    <>
      <PageHeader
        breadcrumbs={crumbs}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.title}
            <TaskStatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} hideMedium />
            <DueBadge item={t} />
          </span>
        }
        description={t.subtask ? `Subtarefa de “${t.parent?.title}”` : `Tarefa da meta “${t.goal.title}”`}
        actions={
          <>
            {track && (
              <Button variant="secondary" icon={<MessageSquarePlus className="size-4" />} onClick={() => setAction('note')}>
                Anotar
              </Button>
            )}
            {track && !closed && (
              <>
                <Button variant="secondary" icon={<Hourglass className="size-4" />} onClick={() => setAction('pendency')}>
                  Pendência
                </Button>
                <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                  Editar
                </Button>
                {!t.startedAt && t.status !== 'ON_HOLD' ? (
                  <Button icon={<Play className="size-4" />} onClick={() => setAction('start')}>
                    Iniciar
                  </Button>
                ) : (
                  <Button icon={<Flag className="size-4" />} onClick={() => setAction('complete')}>
                    Concluir
                  </Button>
                )}
              </>
            )}
            {track && closed && (
              <Button icon={<RotateCcw className="size-4" />} disabled={!!reopenBlocked} title={reopenBlocked ?? undefined} onClick={() => setAction('reopen')}>
                Reabrir
              </Button>
            )}
            <MenuButton
              label="Mais"
              items={[
                // quando o botão principal é "Iniciar", concluir direto fica no menu
                track && !closed && !t.startedAt && t.status !== 'ON_HOLD' && { label: `Concluir ${noun}`, icon: <Flag className="size-4" />, onSelect: () => setAction('complete') },
                track &&
                  !closed &&
                  (t.status === 'ON_HOLD'
                    ? { label: 'Retomar', icon: <Play className="size-4" />, onSelect: () => setAction('resume') }
                    : { label: 'Pausar', icon: <Pause className="size-4" />, onSelect: () => setAction('hold') }),
                track && !closed && { label: `Cancelar ${noun}`, icon: <Ban className="size-4" />, onSelect: () => setAction('cancel'), danger: true },
                access.canDelete && { label: `Excluir ${noun}`, icon: <Trash2 className="size-4" />, onSelect: onDelete, danger: true },
              ]}
            />
          </>
        }
      />

      {t.status === 'ON_HOLD' && (
        <Banner tone="warning" icon={<Pause className="size-4 shrink-0 text-amber-700" />}>
          <span className="font-medium">Pausada desde {formatDateTimeLocal(t.onHoldSince)}</span>
          {t.holdReason && <span className="opacity-80"> · {t.holdReason}</span>}
        </Banner>
      )}
      {t.status === 'COMPLETED' && (
        <Banner tone="success" icon={<CircleCheck className="size-4 shrink-0 text-emerald-600" />}>
          <span className="font-medium">Concluída em {formatDateTimeLocal(t.completedAt)}</span>
          {t.completedBy && <span className="opacity-80"> por {t.completedBy.name}</span>}
          {reopenBlocked && <span className="opacity-80"> · {reopenBlocked.replace(' antes.', ' para reabrir esta.')}</span>}
        </Banner>
      )}
      {t.status === 'CANCELLED' && (
        <Banner tone="neutral" icon={<Ban className="size-4 shrink-0 text-ink-500" />}>
          <span className="font-medium">Cancelada em {formatDateTimeLocal(t.cancelledAt)}</span>
          {t.cancelledBy && <span className="opacity-80"> por {t.cancelledBy.name}</span>}
          {reopenBlocked && <span className="opacity-80"> · {reopenBlocked.replace(' antes.', ' para reabrir esta.')}</span>}
        </Banner>
      )}

      <SummaryStrip task={t} />

      <div className="mt-6 mb-5">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'detalhes', label: 'Detalhes' },
            { value: 'pendencias', label: 'Pendências', count: openCount || undefined },
            { value: 'historico', label: 'Histórico' },
          ]}
        />
      </div>

      {tab === 'detalhes' && (
        <div className="space-y-5 animate-fade-in">
          <Card title="Descrição">
            {t.description ? (
              <p className="text-sm whitespace-pre-line text-ink-800">{t.description}</p>
            ) : (
              <p className="text-sm text-ink-400">Sem descrição.</p>
            )}
          </Card>

          {!t.subtask && (
            <Card
              title="Subtarefas"
              description={t.progress && t.progress.total > 0 ? <ProgressBar progress={t.progress} className="mt-1 max-w-xs" /> : 'Divida a tarefa em passos menores.'}
              padded={false}
              actions={
                canAddSub && (
                  <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setAddingSub(true)}>
                    Nova subtarefa
                  </Button>
                )
              }
            >
              {(t.subtasks ?? []).length === 0 ? (
                <EmptyState icon={<ListTodo className="size-5" />} title="Nenhuma subtarefa" />
              ) : (
                <TaskSiblingList
                  tasks={t.subtasks!}
                  canMove={closed ? undefined : (s) => canTrackTask(access, user?.id, s, { goalOwnerId: ctx.goalOwnerId, parentResponsibleId: t.responsibleUser?.id })}
                />
              )}
            </Card>
          )}

          <p className="text-xs text-ink-400">
            Cadastrada em {formatDateTimeLocal(t.createdAt)} · última alteração em {formatDateTimeLocal(t.updatedAt)}
            {t.startedAt && ` · iniciada em ${formatDateTimeLocal(t.startedAt)}`}
          </p>
        </div>
      )}
      {tab === 'pendencias' && (
        <PendenciesTab
          task={t}
          canAct={track && !closed}
          pendencies={pendencies.data}
          loading={pendencies.isPending}
          error={pendencies.error}
          onRetry={() => pendencies.refetch()}
          onOpen={() => setAction('pendency')}
        />
      )}
      {tab === 'historico' && (
        <TaskTimeline items={timeline.data} loading={timeline.isPending} error={timeline.error} onRetry={() => timeline.refetch()} currentTaskId={t.id} />
      )}

      {action && <TrackActionModal target={{ kind: 'task', task: t }} action={action} onClose={() => setAction(null)} />}
      <TaskFormModal open={editing} onClose={() => setEditing(false)} task={t} parentDueDate={parentTask?.dueDate} />
      <TaskFormModal open={addingSub} onClose={() => setAddingSub(false)} parent={t} />
    </>
  )
}

function Banner({ tone, icon, children }: { tone: 'success' | 'neutral' | 'warning'; icon: ReactNode; children: ReactNode }) {
  return (
    <div
      className={clsx(
        'mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-down',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
        tone === 'neutral' && 'border-ink-200 bg-ink-100/60 text-ink-800',
        tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      {icon}
      <p>{children}</p>
    </div>
  )
}

function SummaryStrip({ task: t }: { task: Task }) {
  const items: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode }[] = [
    { label: 'Responsável', value: responsibleOf(t) ?? '—', sub: `prioridade ${t.priorityLabel.toLowerCase()}`, icon: <UserRound className="size-4" /> },
    {
      label: 'Prazo',
      value: formatDate(t.dueDate),
      sub: t.startDate ? `início ${formatDate(t.startDate)}` : 'sem início previsto',
      icon: <CalendarClock className="size-4" />,
    },
    {
      label: 'Pendências abertas',
      value: t.openPendencies,
      sub: t.oldestOpenPendencyAt ? `mais antiga desde ${formatDate(t.oldestOpenPendencyAt)}` : 'nenhuma',
      icon: <Hourglass className="size-4" />,
    },
    {
      label: 'Última atividade',
      value: formatDate(t.lastActivityAt),
      sub: <span className={clsx(t.idle && !isTaskClosed(t.status) && 'font-medium text-amber-700')}>{idleLabel(t.idleDays)}</span>,
      icon: <NotebookPen className="size-4" />,
    },
  ]
  return (
    <div className="card grid grid-cols-2 divide-ink-100 lg:grid-cols-4 lg:divide-x">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <span className="text-brand-600">{it.icon}</span>
            {it.label}
          </p>
          <p className="mt-1 truncate text-base font-semibold text-ink-900 tabular-nums">{it.value}</p>
          {it.sub && <div className="truncate text-xs text-ink-500">{it.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function PendenciesTab({
  task,
  canAct,
  pendencies,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  task: Task
  canAct: boolean
  pendencies: TaskPendency[] | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  onOpen: () => void
}) {
  const [resolving, setResolving] = useState<TaskPendency | null>(null)

  if (loading) return <div className="card"><LoadingBlock /></div>
  if (error) return <div className="card"><ErrorState error={error} onRetry={onRetry} /></div>

  const open = (pendencies ?? []).filter((p) => p.open)
  const resolved = (pendencies ?? []).filter((p) => !p.open)

  return (
    <div className="space-y-5 animate-fade-in">
      <Card
        title="Abertas"
        description="Impedimentos e esperas que seguram a tarefa."
        padded={false}
        actions={
          canAct && (
            <Button size="sm" variant="secondary" icon={<Hourglass className="size-3.5" />} onClick={onOpen}>
              Abrir pendência
            </Button>
          )
        }
      >
        {open.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="size-5" />} title="Nenhuma pendência aberta" description={isTaskClosed(task.status) ? undefined : 'Nada segurando o andamento.'} />
        ) : (
          <ul className="divide-y divide-ink-100">
            {open.map((p) => (
              <PendencyItem key={p.id} pendency={p} onResolve={canAct ? () => setResolving(p) : undefined} />
            ))}
          </ul>
        )}
      </Card>

      {resolved.length > 0 && (
        <Card title="Resolvidas" padded={false}>
          <ul className="divide-y divide-ink-100">
            {resolved.map((p) => (
              <PendencyItem key={p.id} pendency={p} />
            ))}
          </ul>
        </Card>
      )}

      {resolving && <ResolveTaskPendencyModal pendency={resolving} onClose={() => setResolving(null)} />}
    </div>
  )
}

function PendencyItem({ pendency: p, onResolve }: { pendency: TaskPendency; onResolve?: () => void }) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <PendencyKindBadge kind={p.kind} />
          {p.waitingOn && (
            <span className="text-xs text-ink-500">
              depende de <strong className="text-ink-700">{p.waitingOn}</strong>
            </span>
          )}
          <span className="text-xs text-ink-400">· {p.open ? `aberta há ${daysLabel(p.daysOpen)}` : `ficou aberta ${daysLabel(p.daysOpen)}`}</span>
        </div>
        <p className={clsx('mt-1.5 text-sm whitespace-pre-line', p.open ? 'text-ink-900' : 'text-ink-600')}>{p.description}</p>
        <p className="mt-1 text-xs text-ink-500">
          Aberta em {formatDateTimeLocal(p.openedAt)}
          {p.openedBy && ` por ${p.openedBy.name}`}
        </p>
        {!p.open && (
          <div className="mt-2 rounded-lg bg-emerald-50/70 px-3 py-2 text-sm">
            <p className="whitespace-pre-line text-emerald-900">{p.resolution}</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Resolvida em {formatDateTimeLocal(p.resolvedAt)}
              {p.resolvedBy && ` por ${p.resolvedBy.name}`}
            </p>
          </div>
        )}
      </div>
      {onResolve && (
        <Button size="sm" icon={<CheckCircle2 className="size-3.5" />} onClick={onResolve}>
          Resolver
        </Button>
      )}
    </li>
  )
}
