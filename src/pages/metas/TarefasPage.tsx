import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { CornerDownRight, ListTodo, X } from 'lucide-react'
import type { TaskFilters, TaskLevel, TaskPriority, TaskSort, TaskStatus } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useTaskOptions, useTasks, useTaskSummary } from '@/queries/tasks'
import { PRIORITIES, PRIORITY_LABEL, TASK_SORT_LABEL, TASK_STATUS_LABEL, TASK_STATUSES, idleLabel, isTaskClosed, responsibleOf } from '@/lib/tasks'
import { formatDate } from '@/lib/format'
import { PageHeader, Tabs } from '@/components/ui/Layout'
import { Button } from '@/components/ui/Button'
import { SearchInput, Select, Switch } from '@/components/ui/Form'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { DueBadge, PriorityBadge, ProgressBar, TaskStatusBadge } from '@/components/tasks/TaskUi'

/** Atalhos: cada aba aplica um recorte (combinado com os demais filtros). */
type View = 'abertas' | 'pendentes' | 'prazo' | 'atrasadas' | 'paradas' | 'concluidas' | 'todas'
const VIEWS: View[] = ['abertas', 'pendentes', 'prazo', 'atrasadas', 'paradas', 'concluidas', 'todas']

function viewFilters(view: View, alertDays: number, idleDays: number): TaskFilters {
  switch (view) {
    case 'abertas':
      return { open: true }
    case 'pendentes':
      return { pending: true, sort: 'OLDEST_PENDENCY' }
    case 'prazo':
      return { dueWithinDays: alertDays, sort: 'DUE_DATE' }
    case 'atrasadas':
      return { overdue: true, sort: 'DUE_DATE' }
    case 'paradas':
      return { idleDays, sort: 'IDLE' }
    case 'concluidas':
      return { status: ['COMPLETED'] }
    case 'todas':
      return {}
  }
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

export function TarefasPage() {
  const { tasksAccess: access } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const view = (VIEWS.includes(params.get('ver') as View) ? params.get('ver') : 'abertas') as View
  const goalId = params.get('meta') || undefined
  const responsibleName = params.get('responsavel') || undefined
  const status = (params.get('situacao') || undefined) as TaskStatus | undefined
  const priority = (params.get('prioridade') || undefined) as TaskPriority | undefined
  const level = (params.get('nivel') || undefined) as TaskLevel | undefined
  const mine = params.get('minhas') === '1'
  const sort = (params.get('ordem') || undefined) as TaskSort | undefined
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

  const summary = useTaskSummary({ goalId, responsibleName, mine: mine || undefined }, access.canRead)
  const options = useTaskOptions(goalId, access.canRead)
  const alertDays = summary.data?.deadlineAlertDays ?? 3
  const idleDays = summary.data?.idleDays ?? 7

  const filters = useMemo<TaskFilters>(() => {
    const base = viewFilters(view, alertDays, idleDays)
    return {
      ...base,
      // a situação escolhida no filtro substitui a da aba
      ...(status ? { status: [status], open: undefined } : {}),
      goalId,
      responsibleName,
      priority: priority ? [priority] : undefined,
      level: level && level !== 'ALL' ? level : undefined,
      mine: mine || undefined,
      q: debouncedQ || undefined,
      sort: sort ?? base.sort,
    }
  }, [view, alertDays, idleDays, status, goalId, responsibleName, priority, level, mine, debouncedQ, sort])

  const list = useTasks(filters, access.canRead)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de metas e tarefas." />

  const s = summary.data
  const rows = list.data ?? []
  const hasExtraFilters = !!(goalId || responsibleName || status || priority || level || mine || debouncedQ || sort)
  const counts: Partial<Record<View, number | undefined>> = {
    abertas: s?.open,
    pendentes: s?.pending,
    prazo: s?.nearDue,
    atrasadas: s?.overdue,
    paradas: s?.idle,
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Metas', to: '/metas' }, { label: 'Tarefas' }]}
        title="Tarefas"
        description="Todas as tarefas e subtarefas das metas, com prazos, pendências e responsáveis."
      />

      <div className="mb-4">
        <Tabs<View>
          value={view}
          onChange={(v) => setParam('ver', v === 'abertas' ? undefined : v)}
          tabs={[
            { value: 'abertas', label: 'Em aberto', count: counts.abertas },
            { value: 'pendentes', label: 'Com pendência', count: counts.pendentes || undefined },
            { value: 'prazo', label: 'Perto do prazo', count: counts.prazo || undefined },
            { value: 'atrasadas', label: 'Atrasadas', count: counts.atrasadas || undefined },
            { value: 'paradas', label: 'Paradas', count: counts.paradas || undefined },
            { value: 'concluidas', label: 'Concluídas' },
            { value: 'todas', label: 'Todas' },
          ]}
        />
      </div>

      <div className="card mb-4 p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <SearchInput className="xl:w-72" placeholder="Buscar por título ou descrição…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
            <Select aria-label="Situação" value={status ?? ''} onChange={(e) => setParam('situacao', e.target.value || undefined)}>
              <option value="">Situação da aba</option>
              {TASK_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {TASK_STATUS_LABEL[st]}
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
            <Select aria-label="Ordenar por" value={filters.sort ?? 'RECENT'} onChange={(e) => setParam('ordem', e.target.value === 'RECENT' ? undefined : e.target.value)}>
              {(Object.keys(TASK_SORT_LABEL) as TaskSort[]).map((k) => (
                <option key={k} value={k}>
                  {TASK_SORT_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
          <Switch checked={mine} onChange={(v) => setParam('minhas', v ? '1' : undefined)} label="Só minhas tarefas" />
          {hasExtraFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="size-3.5" />}
              onClick={() => {
                setQ('')
                setParams(view === 'abertas' ? {} : { ver: view }, { replace: true })
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
          <EmptyState icon={<ListTodo className="size-5" />} title="Nenhuma tarefa neste filtro" />
        </div>
      ) : (
        <div className={clsx('card overflow-hidden transition-opacity', list.isPlaceholderData && 'opacity-60')}>
          <div className="border-b border-ink-100 px-4 py-2.5 text-xs text-ink-500">
            {rows.length} tarefa{rows.length === 1 ? '' : 's'}
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Situação</th>
                  <th>Prazo</th>
                  <th>Responsável</th>
                  <th>Atividade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer hover:bg-brand-50/40"
                    onClick={() => navigate(`/metas/tarefas/${t.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/metas/tarefas/${t.id}`)}
                    tabIndex={0}
                  >
                    <td className="max-w-[24rem]">
                      <div className="flex items-start gap-1.5">
                        {t.subtask && <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-label="Subtarefa" />}
                        <div className="min-w-0">
                          <p className="flex items-center gap-2">
                            <span className="truncate font-medium text-ink-900">{t.title}</span>
                            <PriorityBadge priority={t.priority} hideMedium />
                          </p>
                          <p className="truncate text-xs text-ink-500">
                            {t.goal.title}
                            {t.parent && ` › ${t.parent.title}`}
                          </p>
                          {t.progress && t.progress.total > 0 && <ProgressBar progress={t.progress} className="mt-1 max-w-40" />}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <TaskStatusBadge status={t.status} />
                        {t.openPendencies > 0 && (
                          <span className="text-[11px] text-ink-500">
                            {t.openPendencies} pendência{t.openPendencies > 1 ? 's' : ''}
                            {t.oldestOpenPendencyAt && ` · desde ${formatDate(t.oldestOpenPendencyAt)}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-ink-700 tabular-nums">{formatDate(t.dueDate)}</span>
                        <DueBadge item={t} hideOk />
                      </div>
                    </td>
                    <td className="max-w-[12rem]">
                      <p className="truncate text-ink-800">{responsibleOf(t) ?? '—'}</p>
                    </td>
                    <td className="whitespace-nowrap">
                      <span
                        className={clsx('text-xs', t.idle && !isTaskClosed(t.status) ? 'font-medium text-amber-700' : 'text-ink-500')}
                        title={`Última atividade: ${formatDate(t.lastActivityAt)}`}
                      >
                        {idleLabel(t.idleDays)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
