import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { BarChart3, CalendarClock, CalendarX2, ChevronRight, Hourglass, ListTodo, Pause, TrendingUp, X } from 'lucide-react'
import type { TaskDeadlineStatus, TaskPriority, TaskStatsFilters } from '@/api'
import { useTaskOptions, useTaskStats } from '@/queries/tasks'
import { PRIORITIES, PRIORITY_LABEL } from '@/lib/tasks'
import { Button } from '@/components/ui/Button'
import { Select, Switch } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { ErrorState } from '@/components/ui/States'
import { LoadingBlock, Skeleton } from '@/components/ui/Spinner'
import { BoardPie, ChartCard, MeterList, RankedBars, WeeklyChart } from '@/components/tasks/TaskCharts'
import { GoalDetailPanel, ResponsibleTasksModal } from '@/components/tasks/OverviewDetails'

/** Quantas pessoas/metas aparecem nos rankings antes de juntar o resto. */
const TOP = 8

const DEADLINE_LABEL: Record<Exclude<TaskDeadlineStatus, 'CLOSED'>, string> = {
  OVERDUE: 'Atrasadas',
  NEAR: 'Perto do prazo',
  OK: 'No prazo',
  NO_DUE: 'Sem prazo',
}

/** Só o número de atrasadas, em vermelho; nada quando não há. */
const overdueNote = (n: number) => (n > 0 ? <span className="font-medium text-red-600">{n} atrasada{n > 1 ? 's' : ''}</span> : undefined)

/** Cartão-botão que abre um modal com mais detalhes. */
function MoreCard({ icon, title, summary, onClick }: { icon: ReactNode; title: string; summary: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card card-interactive group flex items-center gap-3 p-4 text-left">
      <span className="rounded-lg bg-brand-50 p-2 text-brand-700">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-900">{title}</span>
        <span className="block truncate text-xs text-ink-500">{summary}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

/**
 * Visão geral das tarefas: um filtro só (acima de tudo) recorta indicadores e gráficos,
 * e os indicadores levam para a lista de tarefas com o mesmo recorte.
 * A tela mostra o essencial; o detalhe fica nos modais e nas metas que abrem para baixo.
 * Parâmetros próprios na URL (pmeta, pessoa, pprioridade, peu) para não brigar com os da lista de metas.
 */
export function MetasOverview() {
  const [params, setParams] = useSearchParams()
  const goalId = params.get('pmeta') || undefined
  const responsibleName = params.get('pessoa') || undefined
  const priority = (params.get('pprioridade') || undefined) as TaskPriority | undefined
  const mine = params.get('peu') === '1'

  const setParam = (key: string, value: string | undefined) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  const filters: TaskStatsFilters = { goalId, responsibleName, priority: priority ? [priority] : undefined, mine: mine || undefined }
  const stats = useTaskStats(filters)
  const options = useTaskOptions(goalId)
  const hasFilters = !!(goalId || responsibleName || priority || mine)
  const [person, setPerson] = useState<string | null>(null)
  const [modal, setModal] = useState<'period' | 'breakdown' | null>(null)

  // Mesmo recorte na lista de tarefas
  const listLink = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams()
    if (goalId) q.set('meta', goalId)
    if (responsibleName) q.set('responsavel', responsibleName)
    if (priority) q.set('prioridade', priority)
    if (mine) q.set('minhas', '1')
    for (const [k, v] of Object.entries(extra)) q.set(k, v)
    const s = q.toString()
    return `/metas/tarefas${s ? `?${s}` : ''}`
  }

  const s = stats.data

  const tiles: { label: string; value?: number; hint?: string; icon: ReactNode; tone?: 'warning' | 'danger'; to: string }[] = [
    { label: 'Abertas', value: s?.open, hint: s ? `${s.total} tarefas no total` : undefined, icon: <ListTodo className="size-4" />, to: listLink() },
    { label: 'Com pendência', value: s?.pending, hint: s ? `${s.byStatus.BLOCKED ?? 0} com impedimento` : undefined, icon: <Hourglass className="size-4" />, tone: 'warning', to: listLink({ ver: 'pendentes' }) },
    { label: 'Perto do prazo', value: s?.nearDue, hint: s ? `Vencem em até ${s.deadlineAlertDays} dias` : undefined, icon: <CalendarClock className="size-4" />, tone: 'warning', to: listLink({ ver: 'prazo' }) },
    { label: 'Atrasadas', value: s?.overdue, icon: <CalendarX2 className="size-4" />, tone: 'danger', to: listLink({ ver: 'atrasadas' }) },
    { label: 'Paradas', value: s?.idle, hint: s ? `Sem atividade há ${s.idleDays}+ dias` : undefined, icon: <Pause className="size-4" />, tone: 'warning', to: listLink({ ver: 'paradas' }) },
  ]

  const people = s?.byResponsible.filter((r) => r.open > 0) ?? []
  const created = s?.weekly.reduce((a, w) => a + w.created, 0) ?? 0
  const done = s?.weekly.reduce((a, w) => a + w.completed, 0) ?? 0

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filtro: uma linha, acima de tudo o que ele recorta */}
      <div className="card flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          <Select aria-label="Meta" value={goalId ?? ''} onChange={(e) => setParam('pmeta', e.target.value || undefined)}>
            <option value="">Todas as metas</option>
            {options.data?.goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
          <Select aria-label="Responsável" value={responsibleName ?? ''} onChange={(e) => setParam('pessoa', e.target.value || undefined)}>
            <option value="">Qualquer responsável</option>
            {options.data?.responsibleNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <Select aria-label="Prioridade" value={priority ?? ''} onChange={(e) => setParam('pprioridade', e.target.value || undefined)}>
            <option value="">Qualquer prioridade</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <Switch checked={mine} onChange={(v) => setParam('peu', v ? '1' : undefined)} label="Só minhas" />
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="size-3.5" />}
              onClick={() =>
                setParams(
                  (p) => {
                    const next = new URLSearchParams(p)
                    ;['pmeta', 'pessoa', 'pprioridade', 'peu'].forEach((k) => next.delete(k))
                    return next
                  },
                  { replace: true },
                )
              }
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {stats.isError ? (
        <div className="card">
          <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
        </div>
      ) : (
        // recarregar mantém o quadro anterior esmaecido, sem pular a tela
        <div className={clsx('space-y-5 transition-opacity', stats.isPlaceholderData && 'opacity-60')}>
          {/* Indicadores: o andamento em destaque e os alertas; cada alerta leva à lista filtrada */}
          <div className="card grid grid-cols-2 divide-ink-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
            <div className="col-span-2 flex flex-col justify-center p-4 sm:col-span-3 lg:col-span-1">
              <span className="text-xs text-ink-500">Concluído</span>
              {s ? (
                <>
                  <span className="text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">{s.percent == null ? '—' : `${s.percent}%`}</span>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--chart-track)' }} role="meter" aria-label="Concluído" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.percent ?? 0}>
                    <div className="h-full rounded-full" style={{ width: `${s.percent ?? 0}%`, background: 'var(--chart-done)' }} />
                  </div>
                  <span className="mt-1 text-[11px] text-ink-400 tabular-nums">
                    {s.byStatus.COMPLETED ?? 0} de {s.total - (s.byStatus.CANCELLED ?? 0)}
                  </span>
                </>
              ) : (
                <Skeleton className="mt-1 h-9 w-20" />
              )}
            </div>
            {tiles.map((t) => {
              const alert = !!t.tone && (t.value ?? 0) > 0
              return (
                <Link key={t.label} to={t.to} title={t.hint} className="group flex flex-col p-4 transition-colors hover:bg-ink-50">
                  <span
                    className={clsx(
                      'flex items-center gap-1.5 text-xs',
                      alert ? (t.tone === 'danger' ? 'text-red-600' : 'text-amber-700') : 'text-ink-500',
                    )}
                  >
                    {t.icon}
                    {t.label}
                  </span>
                  {t.value == null ? (
                    <Skeleton className="mt-1 h-8 w-10" />
                  ) : (
                    <span className={clsx('mt-1 text-2xl font-semibold tracking-tight tabular-nums', alert && t.tone === 'danger' ? 'text-red-600' : 'text-ink-900')}>{t.value}</span>
                  )}
                </Link>
              )
            })}
          </div>

          {!s ? (
            <div className="card">
              <LoadingBlock />
            </div>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-2">
                <ChartCard
                  title="Situação das tarefas"
                  action={
                    <Link to="/metas/quadro" className="text-xs text-brand-700 hover:underline">
                      Abrir quadro
                    </Link>
                  }
                >
                  <BoardPie byStatus={s.byStatus} />
                </ChartCard>

                <ChartCard title="Abertas por responsável" subtitle="Clique no nome para ver as tarefas.">
                  <RankedBars
                    unit={['aberta', 'abertas']}
                    empty="Nenhuma tarefa aberta no recorte."
                    rows={people.slice(0, TOP).map((r) => ({
                      key: r.responsibleName ?? '—',
                      label: r.responsibleName ?? 'Sem responsável',
                      muted: r.responsibleName == null,
                      value: r.open,
                      note: overdueNote(r.overdue),
                      onSelect: r.responsibleName ? () => setPerson(r.responsibleName) : undefined,
                    }))}
                  />
                  {people.length > TOP && <p className="mt-3 text-xs text-ink-500">+ {people.length - TOP} pessoas com tarefas abertas</p>}
                </ChartCard>
              </div>

              <ChartCard title="Andamento por meta" subtitle="Clique numa meta para ver as tarefas dela.">
                <MeterList
                  empty="Nenhuma meta no recorte."
                  rows={s.byGoal.slice(0, TOP).map((g) => ({
                    key: g.goal.id,
                    label: g.goal.title,
                    percent: g.percent,
                    figure: (
                      <>
                        {g.completed}/{g.total - g.cancelled}
                        {g.overdue > 0 && <span className="ml-2 font-medium text-red-600">{g.overdue} atrasada{g.overdue > 1 ? 's' : ''}</span>}
                      </>
                    ),
                  }))}
                  renderDetail={(id) => <GoalDetailPanel goalId={id} />}
                />
              </ChartCard>

              {/* O que é consulta eventual fica em modal */}
              <div className="grid gap-3 sm:grid-cols-2">
                <MoreCard
                  icon={<TrendingUp className="size-4" />}
                  title="Andamento por período"
                  summary={`${created} criadas e ${done} concluídas nas últimas ${s.weekly.length} semanas`}
                  onClick={() => setModal('period')}
                />
                <MoreCard
                  icon={<BarChart3 className="size-4" />}
                  title="Abertas por prioridade e prazo"
                  summary={`${s.byPriority.URGENT ?? 0} urgentes · ${s.byDeadline.NO_DUE ?? 0} sem prazo`}
                  onClick={() => setModal('breakdown')}
                />
              </div>

              <Modal open={modal === 'period'} onClose={() => setModal(null)} title="Andamento por período" description={`Tarefas criadas e concluídas, semana a semana, nas últimas ${s.weekly.length} semanas.`} size="lg">
                <WeeklyChart weekly={s.weekly} />
              </Modal>

              <Modal open={modal === 'breakdown'} onClose={() => setModal(null)} title="Abertas por prioridade e prazo" description="Só tarefas abertas, no recorte atual. Clique para abrir a lista." size="lg">
                <div className="space-y-6">
                  <section>
                    <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Prioridade</h3>
                    <RankedBars
                      unit={['tarefa', 'tarefas']}
                      empty="Nenhuma tarefa aberta no recorte."
                      rows={PRIORITIES.map((p) => ({ key: p, label: PRIORITY_LABEL[p], value: s.byPriority[p] ?? 0, to: listLink({ prioridade: p }) }))}
                    />
                  </section>
                  <section>
                    <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">Prazo</h3>
                    <RankedBars
                      unit={['tarefa', 'tarefas']}
                      empty="Nenhuma tarefa aberta no recorte."
                      rows={(Object.keys(DEADLINE_LABEL) as (keyof typeof DEADLINE_LABEL)[]).map((k) => ({
                        key: k,
                        label: DEADLINE_LABEL[k],
                        value: s.byDeadline[k] ?? 0,
                        to: k === 'OVERDUE' ? listLink({ ver: 'atrasadas' }) : k === 'NEAR' ? listLink({ ver: 'prazo' }) : undefined,
                      }))}
                    />
                  </section>
                </div>
              </Modal>
            </>
          )}
        </div>
      )}

      <ResponsibleTasksModal name={person} onClose={() => setPerson(null)} goalId={goalId} priority={priority} mine={mine} listLink={listLink} />
    </div>
  )
}
