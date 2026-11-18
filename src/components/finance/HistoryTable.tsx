import { useState } from 'react'
import clsx from 'clsx'
import type { ActionHistoryItem, FinanceOperation, SubActionHistoryItem } from '@/api'
import { METHOD_LABEL, formatMoney, formatSigned } from '@/lib/finance'
import { formatDate } from '@/lib/format'
import { MethodIcon } from './FinanceUi'
import { OperationDetailModal, operationContext } from './OperationFeed'

interface Column {
  label: string
  after: number
  delta?: number
}

/** Valor acumulado com a variação da operação logo abaixo. */
function Cell({ after, delta }: Omit<Column, 'label'>) {
  return (
    <td className="text-right whitespace-nowrap">
      <span className="block text-sm text-ink-900 tabular-nums">{formatMoney(after)}</span>
      {delta !== undefined && (
        <span
          className={clsx(
            'block text-[11px] tabular-nums',
            delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-red-600' : 'text-ink-300',
          )}
        >
          {formatSigned(delta)}
        </span>
      )}
    </td>
  )
}

function Table({ rows }: { rows: { operation: FinanceOperation; columns: Column[] }[] }) {
  const [selected, setSelected] = useState<FinanceOperation | null>(null)
  if (rows.length === 0) return null
  const headers = rows[0].columns.map((c) => c.label)
  return (
    <>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Data</th>
              <th>Operação</th>
              {headers.map((h) => (
                <th key={h} className="text-right">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ operation: op, columns }) => (
              <tr key={op.id} className="row-link" onClick={() => setSelected(op)}>
                <td className="whitespace-nowrap text-ink-600 tabular-nums">{formatDate(op.operationDate)}</td>
                <td className="min-w-56">
                  <div className="flex items-center gap-2.5">
                    <MethodIcon method={op.method} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">{METHOD_LABEL[op.method]}</p>
                      <p className="truncate font-mono text-[11px] text-ink-500">
                        #{op.number} · {operationContext(op)}
                      </p>
                    </div>
                  </div>
                </td>
                {columns.map((c) => (
                  <Cell key={c.label} after={c.after} delta={c.delta} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <OperationDetailModal operation={selected} onClose={() => setSelected(null)} />
    </>
  )
}

export function ActionHistoryTable({ items }: { items: ActionHistoryItem[] }) {
  return (
    <Table
      rows={items.map((h) => ({
        operation: h.operation,
        columns: [
          { label: 'Total', after: h.totalAfter, delta: h.totalDelta },
          { label: 'A distribuir', after: h.undistributedAfter, delta: h.undistributedDelta },
          { label: 'Empenhado', after: h.committedAfter, delta: h.committedDelta },
          { label: 'Liquidado', after: h.liquidatedAfter, delta: h.liquidatedDelta },
          { label: 'Pago', after: h.paidAfter, delta: h.paidDelta },
          { label: 'Disponível', after: h.availableAfter },
        ],
      }))}
    />
  )
}

export function SubActionHistoryTable({ items }: { items: SubActionHistoryItem[] }) {
  return (
    <Table
      rows={items.map((h) => ({
        operation: h.operation,
        columns: [
          { label: 'Dotação', after: h.balanceAfter, delta: h.delta },
          { label: 'Empenhado', after: h.committedAfter, delta: h.committedDelta },
          { label: 'Liquidado', after: h.liquidatedAfter, delta: h.liquidatedDelta },
          { label: 'Pago', after: h.paidAfter, delta: h.paidDelta },
          { label: 'Disponível', after: h.availableAfter },
        ],
      }))}
    />
  )
}
