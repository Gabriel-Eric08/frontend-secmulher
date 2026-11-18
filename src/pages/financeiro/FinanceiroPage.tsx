import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowLeftRight, ChevronDown, FilePlus2, Landmark, Plus, Shuffle, Wallet } from 'lucide-react'
import type { FinanceAction } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { FINANCE_TABLE } from '@/auth/access'
import { useCategories } from '@/queries/admin'
import { useFinanceDashboard } from '@/queries/finance'
import { formatMoney, formatPct } from '@/lib/finance'
import { normalize } from '@/lib/format'
import { PageHeader } from '@/components/ui/Layout'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SearchInput, Switch } from '@/components/ui/Form'
import { MenuButton } from '@/components/ui/Menu'
import { Alert, EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { AsOfBanner, AsOfDatePicker, useAsOfDate } from '@/components/finance/AsOfDate'
import { ExecutionBar, ExecutionLegend } from '@/components/finance/ExecutionBar'
import { CodeTag, InactiveBadge, Metric, Money } from '@/components/finance/FinanceUi'
import { ActionFormModal } from '@/components/finance/ActionFormModals'
import { TransferModal } from '@/components/finance/BudgetOperationModals'
import { CommitmentFormModal } from '@/components/finance/CommitmentModals'


export function FinanceiroPage() {
  const { financeAccess: access, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [date, setDate] = useAsOfDate()
  const dashboard = useFinanceDashboard(date, access.canRead)
  const categories = useCategories()
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [modal, setModal] = useState<null | 'action' | 'transferA' | 'transferB' | 'commitment'>(null)

  const hasCategory = (categories.data ?? []).some((c) => c.entityType === 'native' && c.tableReference === FINANCE_TABLE)

  const actions = useMemo(() => {
    let list = dashboard.data?.actions ?? []
    if (!showInactive) list = list.filter((a) => a.isActive)
    if (q.trim()) {
      const n = normalize(q.trim())
      list = list.filter(
        (a) =>
          normalize(`${a.code} ${a.name}`).includes(n) ||
          a.subActions.some((s) => normalize(`${s.code} ${s.name}`).includes(n)),
      )
    }
    return [...list].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }))
  }, [dashboard.data, q, showInactive])

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo financeiro." />

  const d = dashboard.data
  const inactiveCount = (d?.actions ?? []).filter((a) => !a.isActive).length

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Ações orçamentárias, subações e execução da despesa."
        actions={
          <>
            <AsOfDatePicker value={date} onChange={setDate} />
            {access.canUpdate && (
              <MenuButton
                label="Operação"
                items={[
                  {
                    label: 'Novo empenho',
                    description: 'Reservar disponível para um favorecido',
                    icon: <FilePlus2 className="size-4" />,
                    onSelect: () => setModal('commitment'),
                  },
                  {
                    label: 'Transferir entre subações',
                    description: 'Método A · dentro da mesma ação',
                    icon: <ArrowLeftRight className="size-4" />,
                    onSelect: () => setModal('transferA'),
                  },
                  {
                    label: 'Transferir entre ações',
                    description: 'Método B · para subação de outra ação',
                    icon: <Shuffle className="size-4" />,
                    onSelect: () => setModal('transferB'),
                  },
                ]}
              />
            )}
            {access.canCreate && (
              <Button icon={<Plus className="size-4" />} onClick={() => setModal('action')}>
                Nova ação
              </Button>
            )}
          </>
        }
      />

      <AsOfBanner date={date} onReset={() => setDate(undefined)} />

      {isAdmin && categories.isSuccess && !hasCategory && (
        <div className="mb-6">
          <Alert
            tone="warning"
            title="Categoria do financeiro não configurada"
            action={
              <ButtonLink to="/admin/categorias?setup=financeiro" size="sm" variant="secondary">
                Configurar agora
              </ButtonLink>
            }
          >
            Sem ela, apenas administradoras acessam o financeiro. Crie a categoria nativa para conceder permissões à equipe.
          </Alert>
        </div>
      )}

      {dashboard.isPending ? (
        <div className="card">
          <LoadingBlock />
        </div>
      ) : dashboard.isError ? (
        <div className="card">
          <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
        </div>
      ) : (
        <>
          {/* Visão geral */}
          <section className="card mb-6 grid gap-0 overflow-hidden lg:grid-cols-[1fr_20rem]">
            <div className="p-6">
              <p className="flex items-center gap-2 text-sm text-ink-500">
                <Landmark className="size-4 text-brand-600" /> Orçamento total
              </p>
              <p className="mt-1 text-4xl font-semibold tracking-tight text-ink-900 tabular-nums">
                {formatMoney(d!.totalAmount)}
              </p>
              <p className="mt-1 text-sm text-ink-500">
                {formatPct(d!.committedAmount, d!.totalAmount)} empenhado ·{' '}
                {formatPct(d!.paidAmount, d!.totalAmount)} pago
              </p>
              <ExecutionBar
                className="mt-6"
                size="lg"
                total={d!.totalAmount}
                committed={d!.committedAmount}
                liquidated={d!.liquidatedAmount}
                paid={d!.paidAmount}
              />
              <div className="mt-5">
                <ExecutionLegend
                  total={d!.totalAmount}
                  committed={d!.committedAmount}
                  liquidated={d!.liquidatedAmount}
                  paid={d!.paidAmount}
                  available={d!.availableAmount}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5 border-t border-ink-100 bg-ink-50/60 p-6 lg:grid-cols-1 lg:border-t-0 lg:border-l">
              <Metric
                label="Distribuído às subações"
                value={d!.distributedAmount}
                hint={`${formatPct(d!.distributedAmount, d!.totalAmount)} do total`}
              />
              <Metric
                label="Saldo a distribuir"
                value={d!.undistributedAmount}
                tone={d!.undistributedAmount > 0 ? 'warning' : 'default'}
                hint="Ainda não repartido entre subações"
              />
              <Metric label="Disponível para empenho" value={d!.availableAmount} tone="brand" hint="Total − empenhado" />
            </div>
          </section>

          {/* Ações */}
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-ink-900">
              Ações <span className="ml-1 text-sm font-normal text-ink-400">{actions.length}</span>
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {inactiveCount > 0 && (
                <Switch checked={showInactive} onChange={setShowInactive} label={`Inativas (${inactiveCount})`} />
              )}
              <SearchInput
                className="sm:w-72"
                placeholder="Buscar ação ou subação…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {actions.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Wallet className="size-5" />}
                title={q ? 'Nenhuma ação encontrada' : 'Nenhuma ação cadastrada'}
                description={q ? undefined : 'Cadastre a primeira ação orçamentária com o seu valor inicial.'}
                action={
                  !q &&
                  access.canCreate && (
                    <Button icon={<Plus className="size-4" />} onClick={() => setModal('action')}>
                      Nova ação
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {actions.map((a) => (
                <ActionCard key={a.id} action={a} date={date} />
              ))}
            </ul>
          )}
        </>
      )}

      <ActionFormModal
        open={modal === 'action'}
        onClose={() => setModal(null)}
        onCreated={(a) => navigate(`/financeiro/acoes/${a.id}`)}
      />
      <TransferModal open={modal === 'transferA' || modal === 'transferB'} mode={modal === 'transferB' ? 'B' : 'A'} onClose={() => setModal(null)} />
      <CommitmentFormModal
        open={modal === 'commitment'}
        onClose={() => setModal(null)}
        onCreated={(c) => navigate(`/financeiro/empenhos/${c.commitment.id}`)}
      />
    </>
  )
}


function ActionCard({ action: a, date }: { action: FinanceAction; date?: string }) {
  const [open, setOpen] = useState(false)
  const qs = date ? `?data=${date}` : ''
  const subs = [...a.subActions].sort((x, y) => x.code.localeCompare(y.code, 'pt-BR', { numeric: true }))
  return (
    <li className={clsx('card card-interactive overflow-hidden', !a.isActive && 'opacity-70')}>
      <div className="flex items-stretch">
        <Link to={`/financeiro/acoes/${a.id}${qs}`} className="grid min-w-0 flex-1 gap-4 p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CodeTag>{a.code}</CodeTag>
              <InactiveBadge active={a.isActive} />
              {a.undistributedAmount > 0 && (
                <span className="text-[11px] font-medium text-amber-700 tabular-nums">
                  {formatMoney(a.undistributedAmount)} a distribuir
                </span>
              )}
            </div>
            <p className="mt-1.5 truncate font-medium text-ink-900">{a.name}</p>
            <p className="text-xs text-ink-400">
              {a.subActions.length} subaç{a.subActions.length === 1 ? 'ão' : 'ões'}
            </p>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-[11px] text-ink-500">
              <span>{formatPct(a.committedAmount, a.totalAmount)} empenhado</span>
              <span>{formatPct(a.paidAmount, a.totalAmount)} pago</span>
            </div>
            <ExecutionBar total={a.totalAmount} committed={a.committedAmount} liquidated={a.liquidatedAmount} paid={a.paidAmount} />
          </div>
          <div className="flex gap-6 md:block md:text-right">
            <div>
              <p className="text-[11px] text-ink-400">Total</p>
              <p className="font-semibold text-ink-900 tabular-nums">{formatMoney(a.totalAmount)}</p>
            </div>
            <div className="md:mt-1">
              <p className="text-[11px] text-ink-400">Disponível</p>
              <p className="text-sm font-medium text-brand-700 tabular-nums">{formatMoney(a.availableAmount)}</p>
            </div>
          </div>
        </Link>
        {subs.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-11 shrink-0 items-center justify-center border-l border-ink-100 text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
            aria-expanded={open}
            aria-label={open ? 'Ocultar subações' : 'Mostrar subações'}
          >
            <ChevronDown className={clsx('size-4 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>
      {open && (
        <ul className="animate-fade-down divide-y divide-ink-100 border-t border-ink-100 bg-ink-50/50">
          {subs.map((s) => (
            <li key={s.id}>
              <Link
                to={`/financeiro/subacoes/${s.id}${qs}`}
                className="list-link grid gap-2 px-5 py-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_10rem] sm:items-center"
              >
                <p className="flex min-w-0 items-center gap-2 text-sm">
                  <CodeTag>{s.code}</CodeTag>
                  <span className="truncate text-ink-700">{s.name}</span>
                  <InactiveBadge active={s.isActive} />
                </p>
                <ExecutionBar total={s.balance} committed={s.committedAmount} liquidated={s.liquidatedAmount} paid={s.paidAmount} size="sm" />
                <p className="text-sm sm:text-right">
                  <Money value={s.availableAmount} className="text-ink-800" />
                  <span className="text-ink-400"> / </span>
                  <Money value={s.balance} className="text-xs text-ink-400" />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
