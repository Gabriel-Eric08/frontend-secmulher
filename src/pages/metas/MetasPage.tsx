import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarClock, CalendarX2, Hourglass, ListChecks, ListTodo, Pause, Plus, Target, UserRound, X } from 'lucide-react'
import type { GoalFilters, GoalSort, TaskGoalStatus } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useGoals, useTaskOptions, useTaskSummary } from '@/queries/tasks'
import { GOAL_SORT_LABEL, GOAL_STATUS_LABEL, GOAL_STATUSES, idleLabel } from '@/lib/tasks'
import { formatDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/Layout'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SearchInput, Select, Switch } from '@/components/ui/Form'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock, Skeleton } from '@/components/ui/Spinner'
import { DueBadge, GoalStatusBadge, ProgressBar } from '@/components/tasks/TaskUi'
import { GoalFormModal } from '@/components/tasks/TaskModals'

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function MetasPage() {
  const { tasksAccess: access } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)

  const status = (params.get('situacao') || undefined) as TaskGoalStatus | undefined
  const all = params.get('todas') === '1'
  const mine = params.get('minhas') === '1'
  const ownerUserId = params.get('responsavel') || undefined
  const sort = (params.get('ordem') || undefined) as GoalSort | undefined
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

  const filters = useMemo<GoalFilters>(
    () => ({
      status: status ? [status] : undefined,
      open: !status && !all ? true : undefined,
      mine: mine || undefined,
      ownerUserId,
      q: debouncedQ || undefined,
      sort,
    }),
    [status, all, mine, ownerUserId, debouncedQ, sort],
  )

  const goals = useGoals(filters, access.canRead)
  const summary = useTaskSummary(undefined, access.canRead)
  const mySummary = useTaskSummary({ mine: true }, access.canRead)
  const options = useTaskOptions(undefined, access.canRead)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de metas e tarefas." />

  const s = summary.data
  const rows = goals.data ?? []
  const hasFilters = !!(status || all || mine || ownerUserId || debouncedQ || sort)

  const cards: { to: string; label: string; value?: number; hint?: string; icon: ReactNode; tone?: 'warning' | 'danger' }[] = [
    { to: '/metas/tarefas?minhas=1', label: 'Minhas tarefas abertas', value: mySummary.data?.open, icon: <UserRound className="size-5" /> },
    { to: '/metas/tarefas', label: 'Tarefas abertas', value: s?.open, hint: s ? `${s.total} no total` : undefined, icon: <ListTodo className="size-5" /> },
    { to: '/metas/tarefas?ver=pendentes', label: 'Com pendência', value: s?.pending, hint: s ? `${s.byStatus.BLOCKED ?? 0} com impedimento` : undefined, icon: <Hourglass className="size-5" />, tone: 'warning' },
    { to: '/metas/tarefas?ver=prazo', label: 'Perto do prazo', value: s?.nearDue, hint: s ? `vence em até ${s.deadlineAlertDays} dias` : undefined, icon: <CalendarClock className="size-5" />, tone: 'warning' },
    { to: '/metas/tarefas?ver=atrasadas', label: 'Atrasadas', value: s?.overdue, icon: <CalendarX2 className="size-5" />, tone: 'danger' },
    { to: '/metas/tarefas?ver=paradas', label: 'Paradas', value: s?.idle, hint: s ? `sem atividade há ${s.idleDays}+ dias` : undefined, icon: <Pause className="size-5" />, tone: 'warning' },
  ]

  return (
    <>
      <PageHeader
        title="Metas e tarefas"
        description="Trilhas de metas: cada meta reúne tarefas e subtarefas com prazo, responsável e pendências."
        actions={
          <>
            <ButtonLink to="/metas/tarefas" variant="secondary" icon={<ListChecks className="size-4" />}>
              Todas as tarefas
            </ButtonLink>
            {access.canCreate && (
              <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                Nova meta
              </Button>
            )}
          </>
        }
      />

      {/* Painel das tarefas: cada cartão abre a lista de tarefas já filtrada */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="card card-interactive flex flex-col items-start p-4 text-left">
            <span
              className={clsx(
                'mb-2 rounded-lg p-2',
                c.tone === 'danger' && (c.value ?? 0) > 0
                  ? 'bg-red-50 text-red-600'
                  : c.tone === 'warning' && (c.value ?? 0) > 0
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-brand-50 text-brand-700',
              )}
            >
              {c.icon}
            </span>
            <span className="text-xs text-ink-500">{c.label}</span>
            {c.value == null ? (
              <Skeleton className="mt-1 h-7 w-10" />
            ) : (
              <span className="text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{c.value}</span>
            )}
            {c.hint && <span className="mt-0.5 text-[11px] text-ink-400">{c.hint}</span>}
          </Link>
        ))}
      </div>

      {/* Filtros das metas */}
      <div className="card mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput className="lg:w-80" placeholder="Buscar meta por título ou descrição…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
            <Select aria-label="Situação" value={status ?? ''} onChange={(e) => setParam('situacao', e.target.value || undefined)}>
              <option value="">{all ? 'Todas as situações' : 'Em aberto'}</option>
              {GOAL_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {GOAL_STATUS_LABEL[st]}
                </option>
              ))}
            </Select>
            <Select aria-label="Responsável pela meta" value={ownerUserId ?? ''} onChange={(e) => setParam('responsavel', e.target.value || undefined)}>
              <option value="">Qualquer responsável</option>
              {options.data?.goalOwners.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
            <Select aria-label="Ordenar por" value={sort ?? 'RECENT'} onChange={(e) => setParam('ordem', e.target.value === 'RECENT' ? undefined : e.target.value)}>
              {(Object.keys(GOAL_SORT_LABEL) as GoalSort[]).map((k) => (
                <option key={k} value={k}>
                  {GOAL_SORT_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
          <div className="flex flex-wrap items-center gap-4">
            <Switch checked={mine} onChange={(v) => setParam('minhas', v ? '1' : undefined)} label="Só metas sob minha responsabilidade" />
            {!status && (
              <button
                type="button"
                onClick={() => setParam('todas', all ? undefined : '1')}
                className={clsx('text-sm', all ? 'font-medium text-brand-700' : 'text-ink-500 hover:text-ink-800')}
              >
                {all ? 'Mostrando todas' : 'Ver todas (inclui encerradas)'}
              </button>
            )}
          </div>
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

      {goals.isPending ? (
        <div className="card">
          <LoadingBlock />
        </div>
      ) : goals.isError ? (
        <div className="card">
          <ErrorState error={goals.error} onRetry={() => goals.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Target className="size-5" />}
            title={hasFilters ? 'Nenhuma meta neste filtro' : 'Nenhuma meta em aberto'}
            description={!hasFilters ? 'Crie uma meta e distribua as tarefas entre a equipe.' : undefined}
            action={
              access.canCreate &&
              !hasFilters && (
                <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                  Nova meta
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className={clsx('grid gap-4 md:grid-cols-2 xl:grid-cols-3 transition-opacity', goals.isPlaceholderData && 'opacity-60')}>
          {rows.map((g) => (
            <Link key={g.id} to={`/metas/${g.id}`} className="card card-interactive flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-2 font-semibold text-ink-900">{g.title}</h3>
                <GoalStatusBadge status={g.status} />
              </div>
              {g.description && <p className="mt-1 line-clamp-2 text-sm text-ink-500">{g.description}</p>}
              <div className="mt-4 mb-4">
                <ProgressBar progress={g.progress} />
                <p className="mt-1 text-xs text-ink-500">
                  {g.progress.percent == null
                    ? 'Nenhuma tarefa ainda'
                    : `${g.progress.percent}% concluído · ${g.progress.total - g.progress.cancelled} tarefa${g.progress.total - g.progress.cancelled === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink-100 pt-3 text-xs text-ink-500">
                <span className="flex items-center gap-1">
                  <UserRound className="size-3.5" />
                  {g.owner?.name ?? 'Sem responsável'}
                </span>
                {g.dueDate && <span className="tabular-nums">Prazo {formatDate(g.dueDate)}</span>}
                <DueBadge item={g} hideOk />
                {g.idle && <span className="font-medium text-amber-700">{idleLabel(g.idleDays)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <GoalFormModal open={creating} onClose={() => setCreating(false)} onSaved={(g) => navigate(`/metas/${g.id}`)} />
    </>
  )
}
