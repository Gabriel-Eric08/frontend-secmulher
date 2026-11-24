import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarClock, CalendarX2, CheckCircle2, FileStack, FolderOpen, Hourglass, Landmark, Plus, Settings2, X } from 'lucide-react'
import type { AmendmentFilters, AmendmentSort, AmendmentStatus, AmendmentSummaryFilters } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useAmendmentOptions, useAmendments, useAmendmentSectors, useAmendmentSummary } from '@/queries/amendments'
import { AMENDMENT_STATUS_LABEL, AMENDMENT_STATUSES, SORT_LABEL, idleLabel, responsibleOf } from '@/lib/amendments'
import { formatMoney, formatMoneyCompact, sumMoney } from '@/lib/finance'
import { formatDate } from '@/lib/format'
import { PageHeader } from '@/components/ui/Layout'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SearchInput, Select, Switch } from '@/components/ui/Form'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock, Skeleton } from '@/components/ui/Spinner'
import { AmendmentStatusBadge, DeadlineBadge } from '@/components/amendments/AmendmentUi'

/** Dias sem atividade para considerar a emenda "parada" (padrão do backend). */
const IDLE_DAYS = 30

/** Atalhos do painel: cada cartão aplica um filtro na tabela. */
type View = 'abertas' | 'pendentes' | 'paradas' | 'vigencia' | 'vencidas' | 'concluidas' | 'todas'

function viewFilters(view: View, alertDays: number): AmendmentFilters {
  switch (view) {
    case 'abertas':
      return { open: true }
    case 'pendentes':
      return { pending: true, sort: 'OLDEST_PENDENCY' }
    case 'paradas':
      return { idleDays: IDLE_DAYS, sort: 'IDLE' }
    case 'vigencia':
      return { deadlineWithinDays: alertDays, sort: 'DEADLINE' }
    case 'vencidas':
      return { expired: true, sort: 'DEADLINE' }
    case 'concluidas':
      return { status: ['COMPLETED'] }
    case 'todas':
      return {}
  }
}

const VIEWS: View[] = ['abertas', 'pendentes', 'paradas', 'vigencia', 'vencidas', 'concluidas', 'todas']

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function EmendasPage() {
  const { amendmentsAccess: access } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  // Filtros na URL: dá para voltar, recarregar e compartilhar a mesma visão
  const view = (VIEWS.includes(params.get('ver') as View) ? params.get('ver') : 'abertas') as View
  const exerciseYear = params.get('ano') ? Number(params.get('ano')) : undefined
  const sectorId = params.get('setor') || undefined
  const cycle = params.get('ciclo') || undefined
  const status = (params.get('situacao') || undefined) as AmendmentStatus | undefined
  const mine = params.get('minhas') === '1'
  const sort = (params.get('ordem') || undefined) as AmendmentSort | undefined
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

  const scope: AmendmentSummaryFilters = { exerciseYear, sectorId, mine: mine || undefined, idleDays: IDLE_DAYS }
  const summary = useAmendmentSummary(scope, access.canRead)
  const options = useAmendmentOptions(access.canRead)
  const sectors = useAmendmentSectors(access.canRead)
  const alertDays = summary.data?.deadlineAlertDays ?? 30

  const filters = useMemo<AmendmentFilters>(() => {
    const base = viewFilters(view, alertDays)
    return {
      ...base,
      // a situação escolhida no filtro substitui a do atalho
      ...(status ? { status: [status], open: undefined } : {}),
      exerciseYear,
      sectorId,
      cycle,
      mine: mine || undefined,
      q: debouncedQ || undefined,
      sort: sort ?? base.sort,
    }
  }, [view, alertDays, status, exerciseYear, sectorId, cycle, mine, debouncedQ, sort])

  const list = useAmendments(filters, access.canRead)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de emendas." />

  const s = summary.data
  const rows = list.data ?? []
  const total = sumMoney(rows.map((a) => a.currentAmount))
  const hasExtraFilters = !!(exerciseYear || sectorId || cycle || status || mine || debouncedQ || sort)

  const cards: { view: View; label: string; value?: number; hint?: string; icon: ReactNode; tone?: 'warning' | 'danger' | 'success' }[] = [
    { view: 'abertas', label: 'Em aberto', value: s?.open, hint: s ? `${s.total} no total` : undefined, icon: <FolderOpen className="size-5" /> },
    { view: 'pendentes', label: 'Com pendência', value: s?.pending, hint: s ? `${s.byStatus.BLOCKED ?? 0} com impedimento` : undefined, icon: <Hourglass className="size-5" />, tone: 'warning' },
    { view: 'paradas', label: 'Paradas', value: s?.idle, hint: `sem atividade há ${IDLE_DAYS}+ dias`, icon: <FileStack className="size-5" />, tone: 'warning' },
    { view: 'vigencia', label: 'Perto da vigência', value: s?.nearDeadline, hint: `vence em até ${alertDays} dias`, icon: <CalendarClock className="size-5" />, tone: 'warning' },
    { view: 'vencidas', label: 'Vigência vencida', value: s?.expired, hint: 'sem conclusão', icon: <CalendarX2 className="size-5" />, tone: 'danger' },
    { view: 'concluidas', label: 'Concluídas', value: s?.byStatus.COMPLETED ?? (s ? 0 : undefined), icon: <CheckCircle2 className="size-5" />, tone: 'success' },
  ]

  return (
    <>
      <PageHeader
        title="Emendas parlamentares"
        description="Acompanhamento das emendas da LOA: pendências, prazos de vigência e linha do tempo."
        actions={
          <>
            <ButtonLink to="/emendas/setores" variant="secondary" icon={<Settings2 className="size-4" />}>
              Setores
            </ButtonLink>
            {access.canCreate && (
              <ButtonLink to="/emendas/nova" icon={<Plus className="size-4" />}>
                Nova emenda
              </ButtonLink>
            )}
          </>
        }
      />

      {/* Painel: contadores clicáveis */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => {
          const active = view === c.view
          return (
            <button
              key={c.view}
              type="button"
              onClick={() => setParam('ver', c.view === 'abertas' ? undefined : active ? undefined : c.view)}
              className={clsx(
                'card card-interactive flex flex-col items-start p-4 text-left',
                active && 'ring-2 ring-accent/60',
              )}
              aria-pressed={active}
            >
              <span
                className={clsx(
                  'mb-2 rounded-lg p-2',
                  c.tone === 'danger' && (c.value ?? 0) > 0
                    ? 'bg-red-50 text-red-600'
                    : c.tone === 'warning' && (c.value ?? 0) > 0
                      ? 'bg-amber-50 text-amber-700'
                      : c.tone === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
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
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="card mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            className="lg:w-80"
            placeholder="Parlamentar, beneficiário, município, código, SEI…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <Select aria-label="Ano (LOA)" value={exerciseYear ?? ''} onChange={(e) => setParam('ano', e.target.value || undefined)}>
              <option value="">Todos os anos</option>
              {options.data?.exerciseYears.map((y) => (
                <option key={y} value={y}>
                  LOA {y}
                </option>
              ))}
            </Select>
            <Select aria-label="Ciclo" value={cycle ?? ''} onChange={(e) => setParam('ciclo', e.target.value || undefined)}>
              <option value="">Todos os ciclos</option>
              {options.data?.cycles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select aria-label="Setor" value={sectorId ?? ''} onChange={(e) => setParam('setor', e.target.value || undefined)}>
              <option value="">Todos os setores</option>
              {sectors.data?.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                  {sc.isActive ? '' : ' (inativo)'}
                </option>
              ))}
            </Select>
            <Select aria-label="Situação" value={status ?? ''} onChange={(e) => setParam('situacao', e.target.value || undefined)}>
              <option value="">Situação do atalho</option>
              {AMENDMENT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {AMENDMENT_STATUS_LABEL[st]}
                </option>
              ))}
            </Select>
            <Select aria-label="Ordenar por" value={filters.sort ?? 'RECENT'} onChange={(e) => setParam('ordem', e.target.value === 'RECENT' ? undefined : e.target.value)}>
              {(Object.keys(SORT_LABEL) as AmendmentSort[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABEL[k]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
          <div className="flex flex-wrap items-center gap-4">
            <Switch checked={mine} onChange={(v) => setParam('minhas', v ? '1' : undefined)} label="Só minhas emendas" />
            <button
              type="button"
              onClick={() => setParam('ver', view === 'todas' ? undefined : 'todas')}
              className={clsx('text-sm', view === 'todas' ? 'font-medium text-brand-700' : 'text-ink-500 hover:text-ink-800')}
            >
              {view === 'todas' ? 'Mostrando todas' : 'Ver todas (inclui encerradas)'}
            </button>
          </div>
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

      {/* Tabela */}
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
          <EmptyState
            icon={<Landmark className="size-5" />}
            title={hasExtraFilters || view !== 'abertas' ? 'Nenhuma emenda neste filtro' : 'Nenhuma emenda em aberto'}
            description={s?.total === 0 ? 'Cadastre a primeira emenda para começar o acompanhamento.' : undefined}
            action={
              access.canCreate &&
              s?.total === 0 && (
                <ButtonLink to="/emendas/nova" icon={<Plus className="size-4" />}>
                  Nova emenda
                </ButtonLink>
              )
            }
          />
        </div>
      ) : (
        <div className={clsx('card overflow-hidden transition-opacity', list.isPlaceholderData && 'opacity-60')}>
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5 text-xs text-ink-500">
            <span>
              {rows.length} emenda{rows.length === 1 ? '' : 's'}
            </span>
            <span className="tabular-nums" title={formatMoney(total)}>
              Valor atual somado: <strong className="text-ink-800">{formatMoneyCompact(total)}</strong>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Emenda</th>
                  <th>Beneficiário / município</th>
                  <th className="text-right">Valor atual</th>
                  <th>Situação</th>
                  <th>Vigência (TF)</th>
                  <th>Atividade</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    className="cursor-pointer hover:bg-brand-50/40"
                    onClick={() => navigate(`/emendas/${a.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/emendas/${a.id}`)}
                    tabIndex={0}
                  >
                    <td className="max-w-[18rem]">
                      <p className="truncate font-medium text-ink-900">{a.parliamentarian}</p>
                      <p className="truncate text-xs text-ink-500">
                        {[a.code && `COD ${a.code}`, `LOA ${a.exerciseYear}`, a.cycle].filter(Boolean).join(' · ')}
                      </p>
                      {a.object && <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">{a.object}</p>}
                    </td>
                    <td className="max-w-[16rem]">
                      <p className="truncate text-ink-800">{a.beneficiary ?? '—'}</p>
                      <p className="truncate text-xs text-ink-500">{a.municipality ?? ''}</p>
                    </td>
                    <td className="text-right whitespace-nowrap tabular-nums">{formatMoney(a.currentAmount)}</td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <AmendmentStatusBadge status={a.status} />
                        {a.openPendencies > 0 && (
                          <span className="text-[11px] text-ink-500">
                            {a.openPendencies} pendência{a.openPendencies > 1 ? 's' : ''}
                            {a.oldestOpenPendencyAt && ` · desde ${formatDate(a.oldestOpenPendencyAt)}`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-ink-700 tabular-nums">{formatDate(a.termEndDate)}</span>
                        <DeadlineBadge amendment={a} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <span
                        className={clsx(
                          'text-xs',
                          (a.idleDays ?? 0) >= IDLE_DAYS && a.status !== 'COMPLETED' && a.status !== 'CANCELLED' ? 'font-medium text-amber-700' : 'text-ink-500',
                        )}
                        title={`Última atividade: ${formatDate(a.lastActivityAt)}`}
                      >
                        {idleLabel(a.idleDays)}
                      </span>
                    </td>
                    <td className="max-w-[12rem]">
                      <p className="truncate text-ink-800">{responsibleOf(a) ?? '—'}</p>
                      {a.sector && <p className="truncate text-xs text-ink-500">{a.sector.name}</p>}
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
