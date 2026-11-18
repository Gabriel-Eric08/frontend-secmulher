import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, CalendarDays, Clock, User } from 'lucide-react'
import type { FinanceEntry, FinanceOperation } from '@/api'
import { ENTRY_KIND_LABEL, METHOD_LABEL, METHOD_TAG, formatMoney, formatSigned } from '@/lib/finance'
import { formatDate, formatDateTime } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { CodeTag, MethodIcon } from './FinanceUi'

/** Resumo curto de onde o dinheiro saiu/entrou, a partir dos lançamentos. */
export function operationContext(op: FinanceOperation): string {
  const subBudget = op.entries.filter((e) => e.kind === 'BUDGET' && e.subActionId)
  const action = op.entries[0]
  switch (op.method) {
    case 'OPENING':
    case 'TAC': {
      const n = subBudget.length
      return `${action?.actionCode ?? ''}${n ? ` · ${n} subaç${n > 1 ? 'ões' : 'ão'}` : ''}`
    }
    case 'DISTRIBUTION': {
      const n = subBudget.length
      return `${action?.actionCode ?? ''} → ${n} subaç${n > 1 ? 'ões' : 'ão'}`
    }
    case 'TRANSFER_BETWEEN_SUB_ACTIONS':
    case 'TRANSFER_BETWEEN_ACTIONS': {
      const from = subBudget.find((e) => e.amount < 0)
      const to = subBudget.find((e) => e.amount > 0)
      return `${from?.subActionCode ?? '?'} → ${to?.subActionCode ?? '?'}`
    }
    default: {
      const sub = op.entries.find((e) => e.subActionCode)
      return [op.commitmentNumber, sub?.subActionCode].filter(Boolean).join(' · ')
    }
  }
}

/** Sinal visual do valor: saída de dotação/anulação em vermelho. */
function amountTone(op: FinanceOperation) {
  if (op.method === 'COMMITMENT_CANCELLATION') return 'text-red-600'
  if (op.method === 'TAC' || op.method === 'OPENING') return 'text-emerald-700'
  return 'text-ink-900'
}

export function OperationRow({ op, onOpen, dense }: { op: FinanceOperation; onOpen: () => void; dense?: boolean }) {
  const tag = METHOD_TAG[op.method]
  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        'list-link group flex w-full items-center gap-3 text-left',
        dense ? 'px-4 py-2.5' : 'px-5 py-3',
      )}
    >
      <MethodIcon method={op.method} size={dense ? 'sm' : 'md'} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium text-ink-900">{METHOD_LABEL[op.method]}</span>
          {tag && <span className="text-xs text-ink-400">{tag}</span>}
          <span className="font-mono text-xs text-ink-500">{operationContext(op)}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-500">
          {op.description || <span className="text-ink-400">Sem descrição</span>}
          {op.performedByName && <span className="text-ink-400"> · {op.performedByName}</span>}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={clsx('text-sm font-semibold tabular-nums', amountTone(op))}>{formatMoney(op.amount)}</p>
        <p className="text-[11px] text-ink-400 tabular-nums">#{op.number}</p>
      </div>
    </button>
  )
}

/** Lista de operações agrupada pela data real, com detalhe em modal. */
export function OperationFeed({ operations, dense }: { operations: FinanceOperation[]; dense?: boolean }) {
  const [selected, setSelected] = useState<FinanceOperation | null>(null)
  const groups: { date: string; items: FinanceOperation[] }[] = []
  for (const op of operations) {
    const last = groups[groups.length - 1]
    if (last && last.date === op.operationDate) last.items.push(op)
    else groups.push({ date: op.operationDate, items: [op] })
  }
  return (
    <>
      <div>
        {groups.map((g) => (
          <section key={g.date}>
            <h3 className="sticky top-0 border-b border-ink-100 bg-surface/95 px-5 py-1.5 text-[11px] font-semibold tracking-wider text-ink-400 uppercase backdrop-blur">
              {formatDate(g.date)}
            </h3>
            <ul className="divide-y divide-ink-100">
              {g.items.map((op) => (
                <li key={op.id}>
                  <OperationRow op={op} onOpen={() => setSelected(op)} dense={dense} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <OperationDetailModal operation={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function EntryLine({ e }: { e: FinanceEntry }) {
  return (
    <tr>
      <td>
        {e.subActionId ? (
          <Link to={`/financeiro/subacoes/${e.subActionId}`} className="hover:text-brand-700">
            <CodeTag>{e.subActionCode}</CodeTag> <span className="text-ink-700">{e.subActionName}</span>
          </Link>
        ) : (
          <Link to={`/financeiro/acoes/${e.actionId}`} className="hover:text-brand-700">
            <CodeTag>{e.actionCode}</CodeTag> <span className="text-ink-700">Valor total da ação</span>
          </Link>
        )}
      </td>
      <td className="text-ink-500">{ENTRY_KIND_LABEL[e.kind]}</td>
      <td className={clsx('text-right font-medium tabular-nums', e.amount < 0 ? 'text-red-600' : 'text-emerald-700')}>
        {formatSigned(e.amount)}
      </td>
    </tr>
  )
}

export function OperationDetailModal({ operation: op, onClose }: { operation: FinanceOperation | null; onClose: () => void }) {
  return (
    <Modal open={!!op} onClose={onClose} title={op ? `Operação #${op.number}` : ''} size="lg">
      {op && (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <MethodIcon method={op.method} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink-900">{op.methodLabel || METHOD_LABEL[op.method]}</p>
              {op.description && <p className="mt-0.5 text-sm whitespace-pre-line text-ink-600">{op.description}</p>}
            </div>
            <p className="text-lg font-semibold text-ink-900 tabular-nums">{formatMoney(op.amount)}</p>
          </div>

          <div className="grid gap-3 rounded-lg bg-ink-50 px-4 py-3 text-sm sm:grid-cols-3">
            <p className="flex items-center gap-2 text-ink-600">
              <CalendarDays className="size-4 text-ink-400" />
              <span>
                <span className="block text-[11px] text-ink-400">Data real</span>
                {formatDate(op.operationDate)}
              </span>
            </p>
            <p className="flex items-center gap-2 text-ink-600">
              <Clock className="size-4 text-ink-400" />
              <span>
                <span className="block text-[11px] text-ink-400">Registrada em</span>
                {formatDateTime(op.registeredAt)}
              </span>
            </p>
            <p className="flex items-center gap-2 text-ink-600">
              <User className="size-4 text-ink-400" />
              <span className="min-w-0">
                <span className="block text-[11px] text-ink-400">Por</span>
                <span className="block truncate">{op.performedByName ?? '—'}</span>
              </span>
            </p>
          </div>

          {op.commitmentId && (
            <Link
              to={`/financeiro/empenhos/${op.commitmentId}`}
              onClick={onClose}
              className="card-interactive group flex items-center justify-between rounded-lg border border-ink-200 px-4 py-2.5 text-sm"
            >
              <span>
                Empenho <span className="font-mono font-medium text-ink-900">{op.commitmentNumber}</span>
              </span>
              <ArrowRight className="size-4 text-ink-400" />
            </Link>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-ink-400 uppercase">
              Lançamentos <Badge className="ml-1">{op.entries.length}</Badge>
            </p>
            <div className="overflow-x-auto rounded-lg border border-ink-200">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Onde</th>
                    <th>Altera</th>
                    <th className="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {op.entries.map((e, i) => (
                    <EntryLine key={i} e={e} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
