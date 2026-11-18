import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { FilePlus2 } from 'lucide-react'
import type { CommitmentStatus } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useCommitments, useFinanceDashboard } from '@/queries/finance'
import { COMMITMENT_STATUS_LABEL, sumMoney } from '@/lib/finance'
import { normalize } from '@/lib/format'
import { PageHeader } from '@/components/ui/Layout'
import { Button } from '@/components/ui/Button'
import { SearchInput, Select } from '@/components/ui/Form'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { Metric } from '@/components/finance/FinanceUi'
import { CommitmentsTable } from '@/components/finance/CommitmentsTable'
import { CommitmentFormModal } from '@/components/finance/CommitmentModals'

const STATUSES: CommitmentStatus[] = ['TO_LIQUIDATE', 'TO_PAY', 'PAID', 'CANCELLED']

export function EmpenhosPage() {
  const { financeAccess: access } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const status = (params.get('situacao') as CommitmentStatus | null) ?? undefined
  const actionId = params.get('acao') ?? undefined

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  // situação e ação filtram no servidor; texto livre filtra aqui (número, favorecido, objeto)
  const commitments = useCommitments({ status, actionId }, access.canRead)
  const dashboard = useFinanceDashboard(undefined, access.canRead)

  const rows = useMemo(() => {
    const list = commitments.data ?? []
    if (!q.trim()) return list
    const n = normalize(q.trim())
    return list.filter((c) => normalize(`${c.number} ${c.creditor} ${c.description ?? ''} ${c.subActionCode}`).includes(n))
  }, [commitments.data, q])

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo financeiro." />

  const totals = {
    committed: sumMoney(rows.map((c) => c.committedAmount)),
    toLiquidate: sumMoney(rows.map((c) => c.toLiquidateAmount)),
    toPay: sumMoney(rows.map((c) => c.toPayAmount)),
    paid: sumMoney(rows.map((c) => c.paidAmount)),
  }

  const actions = [...(dashboard.data?.actions ?? [])].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }))

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Financeiro', to: '/financeiro' }, { label: 'Empenhos' }]}
        title="Empenhos"
        description="Execução da despesa: empenho, liquidação e pagamento."
        actions={
          access.canUpdate && (
            <Button icon={<FilePlus2 className="size-4" />} onClick={() => setCreating(true)}>
              Novo empenho
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {[undefined, ...STATUSES].map((s) => (
          <button
            key={s ?? 'all'}
            onClick={() => setParam('situacao', s ?? '')}
            className={clsx(
              'rounded-full px-3 py-1.5 text-sm transition-colors',
              status === s ? 'bg-brand-700 font-medium text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-ink-300',
            )}
          >
            {s ? COMMITMENT_STATUS_LABEL[s] : 'Todos'}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row">
          <SearchInput
            className="flex-1"
            placeholder="Buscar por número, favorecido ou objeto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select className="sm:w-72" value={actionId ?? ''} onChange={(e) => setParam('acao', e.target.value)}>
            <option value="">Todas as ações</option>
            {actions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </Select>
        </div>

        {commitments.isSuccess && rows.length > 0 && (
          <div className="grid grid-cols-2 gap-5 border-b border-ink-100 px-5 py-4 sm:grid-cols-4">
            <Metric label="Empenhado" value={totals.committed} />
            <Metric label="A liquidar" value={totals.toLiquidate} tone={totals.toLiquidate > 0 ? 'warning' : 'default'} />
            <Metric label="A pagar" value={totals.toPay} tone={totals.toPay > 0 ? 'brand' : 'default'} />
            <Metric label="Pago" value={totals.paid} />
          </div>
        )}

        {commitments.isPending ? (
          <LoadingBlock />
        ) : commitments.isError ? (
          <ErrorState error={commitments.error} onRetry={() => commitments.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={q || status || actionId ? 'Nenhum empenho encontrado' : 'Nenhum empenho registrado'}
            description={q || status || actionId ? 'Ajuste os filtros.' : undefined}
          />
        ) : (
          <CommitmentsTable items={rows} />
        )}
      </div>

      <CommitmentFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(c) => navigate(`/financeiro/empenhos/${c.commitment.id}`)}
      />
    </>
  )
}
