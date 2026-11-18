import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FinanceOperationMethod, OperationFilters } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useFinanceDashboard, useFinanceOperations } from '@/queries/finance'
import { METHOD_GROUPS, METHOD_LABEL, METHOD_TAG } from '@/lib/finance'
import { PageHeader } from '@/components/ui/Layout'
import { Input, Select } from '@/components/ui/Form'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { OperationFeed } from '@/components/finance/OperationFeed'

export function OperacoesPage() {
  const { financeAccess: access } = useAuth()
  const [params, setParams] = useSearchParams()

  // Filtros na URL: o link do histórico filtrado pode ser compartilhado
  const filters: OperationFilters = {
    actionId: params.get('acao') || undefined,
    subActionId: params.get('subacao') || undefined,
    method: (params.get('tipo') as FinanceOperationMethod) || undefined,
    from: params.get('de') || undefined,
    to: params.get('ate') || undefined,
  }
  const set = (key: string, value: string, reset?: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (reset) next.delete(reset)
    setParams(next, { replace: true })
  }

  const operations = useFinanceOperations(filters, access.canRead)
  const dashboard = useFinanceDashboard(undefined, access.canRead)
  const actions = useMemo(
    () => [...(dashboard.data?.actions ?? [])].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true })),
    [dashboard.data],
  )
  const subs = actions.find((a) => a.id === filters.actionId)?.subActions ?? []
  const hasFilter = Object.values(filters).some(Boolean)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo financeiro." />

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Financeiro', to: '/financeiro' }, { label: 'Operações' }]}
        title="Operações"
        description="Histórico imutável de toda movimentação, pela data real em que aconteceu."
      />

      <div className="card">
        <div className="grid gap-3 border-b border-ink-100 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <Select value={filters.method ?? ''} onChange={(e) => set('tipo', e.target.value)} aria-label="Tipo de operação">
            <option value="">Todos os tipos</option>
            {METHOD_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.methods.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                    {METHOD_TAG[m] ? ` (${METHOD_TAG[m]})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <Select value={filters.actionId ?? ''} onChange={(e) => set('acao', e.target.value, 'subacao')} aria-label="Ação">
            <option value="">Todas as ações</option>
            {actions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </Select>
          <Select
            value={filters.subActionId ?? ''}
            onChange={(e) => set('subacao', e.target.value)}
            disabled={!filters.actionId}
            aria-label="Subação"
          >
            <option value="">{filters.actionId ? 'Todas as subações' : 'Escolha uma ação'}</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Input
              type="date"
              className="w-auto"
              aria-label="De"
              value={filters.from ?? ''}
              max={filters.to}
              onChange={(e) => set('de', e.target.value)}
            />
            <span>–</span>
            <Input
              type="date"
              className="w-auto"
              aria-label="Até"
              value={filters.to ?? ''}
              min={filters.from}
              onChange={(e) => set('ate', e.target.value)}
            />
          </div>
        </div>
        {hasFilter && (
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-2 text-xs text-ink-500">
            <span>{operations.data ? `${operations.data.length} operação(ões)` : ''}</span>
            <button className="font-medium text-brand-700 hover:underline" onClick={() => setParams({}, { replace: true })}>
              Limpar filtros
            </button>
          </div>
        )}

        {operations.isPending ? (
          <LoadingBlock />
        ) : operations.isError ? (
          <ErrorState error={operations.error} onRetry={() => operations.refetch()} />
        ) : operations.data.length === 0 ? (
          <EmptyState title={hasFilter ? 'Nenhuma operação encontrada' : 'Nenhuma operação registrada'} />
        ) : (
          <OperationFeed operations={operations.data} />
        )}
      </div>
    </>
  )
}
