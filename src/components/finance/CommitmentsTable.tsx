import { useNavigate } from 'react-router-dom'
import type { Commitment } from '@/api'
import { formatDate } from '@/lib/format'
import { ExecutionBar } from './ExecutionBar'
import { CodeTag, CommitmentStatusBadge, Money } from './FinanceUi'

/** Lista de empenhos; clique na linha abre o detalhe. */
export function CommitmentsTable({ items, showSubAction = true }: { items: Commitment[]; showSubAction?: boolean }) {
  const navigate = useNavigate()
  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>Empenho</th>
            <th>Favorecido</th>
            {showSubAction && <th>Subação</th>}
            <th className="text-right">Empenhado</th>
            <th className="w-40">Execução</th>
            <th className="text-right">A pagar</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr
              key={c.id}
              className="cursor-pointer hover:bg-ink-50"
              onClick={() => navigate(`/financeiro/empenhos/${c.id}`)}
            >
              <td className="whitespace-nowrap">
                <p className="font-mono text-sm font-medium text-ink-900">{c.number}</p>
                <p className="text-[11px] text-ink-400 tabular-nums">{formatDate(c.commitmentDate)}</p>
              </td>
              <td className="max-w-64">
                <p className="truncate text-ink-800">{c.creditor}</p>
                {c.description && <p className="truncate text-xs text-ink-400">{c.description}</p>}
              </td>
              {showSubAction && (
                <td className="whitespace-nowrap">
                  <CodeTag>{c.actionCode}</CodeTag>
                  <span className="mx-1 text-ink-300">/</span>
                  <CodeTag>{c.subActionCode}</CodeTag>
                </td>
              )}
              <td className="text-right whitespace-nowrap">
                <Money value={c.committedAmount} className="text-ink-900" />
                {c.cancelledAmount > 0 && (
                  <p className="text-[11px] text-ink-400 tabular-nums line-through">
                    <Money value={c.amount} />
                  </p>
                )}
              </td>
              <td>
                <ExecutionBar
                  total={c.committedAmount || c.amount}
                  committed={c.committedAmount}
                  liquidated={c.liquidatedAmount}
                  paid={c.paidAmount}
                  size="sm"
                />
              </td>
              <td className="text-right whitespace-nowrap">
                <Money value={c.toPayAmount} />
              </td>
              <td>
                <CommitmentStatusBadge status={c.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
