import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { Ban, CalendarClock, KanbanSquare, CircleCheck, Flag, ListTodo, MessageSquarePlus, NotebookPen, Pause, Pencil, Play, Plus, RotateCcw, Target, Trash2, UserRound } from 'lucide-react'
import type { Goal, Task } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useDeleteGoal, useGoal, useGoalTimeline } from '@/queries/tasks'
import { canCreateTaskIn, canManageGoal, canTrackTask, findTask, idleLabel, isGoalClosed } from '@/lib/tasks'
import { formatDateTimeLocal } from '@/lib/fleet'
import { formatDate } from '@/lib/format'
import { Card, PageHeader, Tabs } from '@/components/ui/Layout'
import { Button, ButtonLink } from '@/components/ui/Button'
import { MenuButton } from '@/components/ui/Menu'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { PageSkeleton } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { DueBadge, GoalStatusBadge, ProgressBar, TaskTimeline } from '@/components/tasks/TaskUi'
import { TaskTree } from '@/components/tasks/TaskList'
import { GoalFormModal, TaskFormModal, TrackActionModal, type TrackAction } from '@/components/tasks/TaskModals'

type Tab = 'tarefas' | 'historico'

export function MetaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const { tasksAccess: access, user } = useAuth()
  const detail = useGoal(access.canRead ? id : undefined)
  const timeline = useGoalTimeline(access.canRead ? id : undefined)
  const del = useDeleteGoal()
  const [tab, setTab] = useState<Tab>('tarefas')
  const [action, setAction] = useState<TrackAction | null>(null)
  const [editing, setEditing] = useState(false)
  const [addingTask, setAddingTask] = useState(false)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de metas e tarefas." />
  if (detail.isPending) return <PageSkeleton />
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />

  const { goal: g, tasks } = detail.data
  const closed = isGoalClosed(g.status)
  const manage = canManageGoal(access, user?.id, g)
  const canAddTask = !closed && canCreateTaskIn(access, user?.id, g)
  // Reordenar = editar a posição: exige poder alterar as tarefas envolvidas
  const canMove = closed
    ? undefined
    : (t: Task) =>
        canTrackTask(access, user?.id, t, {
          goalOwnerId: g.owner?.id,
          parentResponsibleId: findTask(tasks, t.parent?.id)?.responsibleUser?.id,
        })

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir meta',
      message: (
        <>
          A meta <strong>{g.title}</strong> será excluída com todas as tarefas, subtarefas, pendências e o histórico. Não é possível desfazer.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(g.id)
      toast.success('Meta excluída.')
      navigate('/metas')
    } catch (err) {
      toast.error(err)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Metas', to: '/metas' }, { label: g.title }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {g.title}
            <GoalStatusBadge status={g.status} />
            <DueBadge item={g} />
          </span>
        }
        description={g.description ? <span className="line-clamp-2 whitespace-pre-line">{g.description}</span> : undefined}
        actions={
          <>
            {manage && (
              <Button variant="secondary" icon={<MessageSquarePlus className="size-4" />} onClick={() => setAction('note')}>
                Anotar
              </Button>
            )}
            {manage && !closed && (
              <>
                <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                  Editar
                </Button>
                {g.status === 'ON_HOLD' ? (
                  <Button variant="secondary" icon={<Play className="size-4" />} onClick={() => setAction('resume')}>
                    Retomar
                  </Button>
                ) : (
                  <Button variant="secondary" icon={<Pause className="size-4" />} onClick={() => setAction('hold')}>
                    Pausar
                  </Button>
                )}
                <Button icon={<Flag className="size-4" />} onClick={() => setAction('complete')}>
                  Concluir
                </Button>
              </>
            )}
            {manage && closed && (
              <Button icon={<RotateCcw className="size-4" />} onClick={() => setAction('reopen')}>
                Reabrir
              </Button>
            )}
            <MenuButton
              label="Mais"
              items={[
                manage && !closed && { label: 'Cancelar meta', icon: <Ban className="size-4" />, onSelect: () => setAction('cancel'), danger: true },
                access.canDelete && { label: 'Excluir meta', icon: <Trash2 className="size-4" />, onSelect: onDelete, danger: true },
              ]}
            />
          </>
        }
      />

      {g.status === 'ON_HOLD' && (
        <Banner tone="warning" icon={<Pause className="size-4 shrink-0 text-amber-700" />}>
          <span className="font-medium">Pausada desde {formatDateTimeLocal(g.onHoldSince)}</span>
          {g.holdReason && <span className="opacity-80"> · {g.holdReason}</span>}
        </Banner>
      )}
      {g.status === 'COMPLETED' && (
        <Banner tone="success" icon={<CircleCheck className="size-4 shrink-0 text-emerald-600" />}>
          <span className="font-medium">Concluída em {formatDateTimeLocal(g.completedAt)}</span>
          {g.completedBy && <span className="opacity-80"> por {g.completedBy.name}</span>}
        </Banner>
      )}
      {g.status === 'CANCELLED' && (
        <Banner tone="neutral" icon={<Ban className="size-4 shrink-0 text-ink-500" />}>
          <span className="font-medium">Cancelada em {formatDateTimeLocal(g.cancelledAt)}</span>
          {g.cancelledBy && <span className="opacity-80"> por {g.cancelledBy.name}</span>}
          <span className="opacity-80"> · Reabra para editar ou criar tarefas.</span>
        </Banner>
      )}

      <SummaryStrip goal={g} />

      <div className="mt-6 mb-5">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'tarefas', label: 'Tarefas', count: g.progress.total || undefined },
            { value: 'historico', label: 'Histórico' },
          ]}
        />
      </div>

      {tab === 'tarefas' && (
        <Card
          title="Tarefas"
          description="Na ordem definida (use as setas para reordenar). Subtarefas aparecem abaixo da tarefa-mãe."
          padded={false}
          actions={
            <div className="flex gap-2">
              {tasks.length > 0 && (
                <ButtonLink to={`/metas/quadro?meta=${g.id}`} size="sm" variant="secondary" icon={<KanbanSquare className="size-3.5" />}>
                  Ver no quadro
                </ButtonLink>
              )}
              {canAddTask && (
                <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setAddingTask(true)}>
                  Nova tarefa
                </Button>
              )}
            </div>
          }
        >
          {tasks.length === 0 ? (
            <EmptyState
              icon={<ListTodo className="size-5" />}
              title="Nenhuma tarefa nesta meta"
              description={canAddTask ? 'Divida a meta em tarefas com responsável e prazo.' : undefined}
              action={
                canAddTask && (
                  <Button icon={<Plus className="size-4" />} onClick={() => setAddingTask(true)}>
                    Nova tarefa
                  </Button>
                )
              }
            />
          ) : (
            <TaskTree tasks={tasks} canMove={canMove} />
          )}
        </Card>
      )}
      {tab === 'historico' && (
        <TaskTimeline items={timeline.data} loading={timeline.isPending} error={timeline.error} onRetry={() => timeline.refetch()} />
      )}

      <p className="mt-4 text-xs text-ink-400">
        Cadastrada em {formatDateTimeLocal(g.createdAt)} · última alteração em {formatDateTimeLocal(g.updatedAt)}
      </p>

      {action && <TrackActionModal target={{ kind: 'goal', goal: g }} action={action} onClose={() => setAction(null)} />}
      <GoalFormModal open={editing} onClose={() => setEditing(false)} goal={g} />
      <TaskFormModal open={addingTask} onClose={() => setAddingTask(false)} goalId={g.id} />
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

function SummaryStrip({ goal: g }: { goal: Goal }) {
  const counted = g.progress.total - g.progress.cancelled
  const items: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode }[] = [
    {
      label: 'Progresso',
      value: g.progress.percent == null ? '—' : `${g.progress.percent}%`,
      sub: <ProgressBar progress={g.progress} className="mt-1" />,
      icon: <Target className="size-4" />,
    },
    {
      label: 'Tarefas',
      value: `${g.progress.completed} de ${counted}`,
      sub: g.progress.cancelled ? `concluídas · ${g.progress.cancelled} cancelada(s)` : 'concluídas',
      icon: <ListTodo className="size-4" />,
    },
    {
      label: 'Prazo',
      value: formatDate(g.dueDate),
      sub: g.startDate ? `início ${formatDate(g.startDate)}` : 'sem início previsto',
      icon: <CalendarClock className="size-4" />,
    },
    {
      label: 'Última atividade',
      value: formatDate(g.lastActivityAt),
      sub: <span className={clsx(g.idle && 'font-medium text-amber-700')}>{idleLabel(g.idleDays)}</span>,
      icon: <NotebookPen className="size-4" />,
    },
    { label: 'Responsável', value: g.owner?.name ?? '—', sub: 'acompanha todas as tarefas', icon: <UserRound className="size-4" /> },
  ]
  return (
    <div className="card grid grid-cols-2 divide-ink-100 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
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
