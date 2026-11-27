import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ListChecks, Plus, Target, UserRound, X } from 'lucide-react'
import type { GoalFilters, GoalSort, TaskGoalStatus } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useGoals, useTaskOptions } from '@/queries/tasks'
import { GOAL_SORT_LABEL, GOAL_STATUS_LABEL, GOAL_STATUSES, idleLabel } from '@/lib/tasks'
import { formatDate } from '@/lib/format'
import { PageHeader, Tabs } from '@/components/ui/Layout'
import { MetasOverview } from './MetasOverview'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SearchInput, Select, Switch } from '@/components/ui/Form'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
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
  const tab = params.get('aba') === 'metas' ? 'metas' : 'visao'
  const options = useTaskOptions(undefined, access.canRead)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de metas e tarefas." />

  const rows = goals.data ?? []
  const hasFilters = !!(status || all || mine || ownerUserId || debouncedQ || sort)

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

      <div className="mb-5">
        <Tabs<'visao' | 'metas'>
          value={tab}
          onChange={(v) => setParam('aba', v === 'metas' ? 'metas' : undefined)}
          tabs={[
            { value: 'visao', label: 'Visão geral' },
            { value: 'metas', label: 'Metas' },
          ]}
        />
      </div>

      {tab === 'visao' && <MetasOverview />}
      {tab === 'metas' && (
      <>
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

      </>
      )}

      <GoalFormModal open={creating} onClose={() => setCreating(false)} onSaved={(g) => navigate(`/metas/${g.id}`)} />
    </>
  )
}
