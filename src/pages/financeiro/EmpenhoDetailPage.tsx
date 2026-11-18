import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { Ban, Banknote, Check, FileCheck2, Pencil } from 'lucide-react'
import type { CommitmentMovement } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useCommitment } from '@/queries/finance'
import { formatMoney, formatPct } from '@/lib/finance'
import { formatDate, formatDateTime } from '@/lib/format'
import { Card, DescriptionList, PageHeader } from '@/components/ui/Layout'
import { Button, IconButton } from '@/components/ui/Button'
import { ErrorState, ForbiddenState } from '@/components/ui/States'
import { PageSkeleton } from '@/components/ui/Spinner'
import { CodeTag, CommitmentStatusBadge } from '@/components/finance/FinanceUi'
import { CommitmentFormModal, CommitmentMovementModal } from '@/components/finance/CommitmentModals'
import { OperationFeed } from '@/components/finance/OperationFeed'

/** Etapa do fluxo empenho → liquidação → pagamento. */
function Stage({
  label,
  value,
  of,
  done,
  active,
  last,
}: {
  label: string
  value: number
  of: number
  done: boolean
  active: boolean
  last?: boolean
}) {
  return (
    <li className="relative flex-1">
      {!last && (
        <span
          className={clsx('absolute top-4 left-8 hidden h-0.5 w-[calc(100%-2rem)] sm:block', done ? 'bg-brand-600' : 'bg-ink-200')}
          aria-hidden
        />
      )}
      <div className="relative flex items-start gap-3 sm:flex-col sm:gap-2">
        <span
          className={clsx(
            'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-surface',
            done ? 'bg-accent text-white' : active ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-400',
          )}
        >
          {done ? <Check className="size-4" /> : formatPct(value, of)}
        </span>
        <div>
          <p className="text-xs font-medium text-ink-500">{label}</p>
          <p className="text-lg font-semibold text-ink-900 tabular-nums">{formatMoney(value)}</p>
          <p className="text-[11px] text-ink-400">{formatPct(value, of)} do empenhado</p>
        </div>
      </div>
    </li>
  )
}

export function EmpenhoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { financeAccess: access } = useAuth()
  const detail = useCommitment(id)
  const [movement, setMovement] = useState<CommitmentMovement | null>(null)
  const [editing, setEditing] = useState(false)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo financeiro." />
  if (detail.isPending) return <PageSkeleton />
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />

  const { commitment: c, operations } = detail.data
  const base = c.committedAmount

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Financeiro', to: '/financeiro' },
          { label: 'Empenhos', to: '/financeiro/empenhos' },
          { label: c.number },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{c.number}</span>
            <CommitmentStatusBadge status={c.status} />
          </span>
        }
        description={c.creditor}
        actions={
          access.canUpdate && (
            <>
              {c.toLiquidateAmount > 0 && (
                <Button variant="danger-ghost" icon={<Ban className="size-4" />} onClick={() => setMovement('cancellations')}>
                  Anular
                </Button>
              )}
              {c.toLiquidateAmount > 0 && (
                <Button
                  variant={c.toPayAmount > 0 ? 'secondary' : 'primary'}
                  icon={<FileCheck2 className="size-4" />}
                  onClick={() => setMovement('liquidations')}
                >
                  Liquidar
                </Button>
              )}
              {c.toPayAmount > 0 && (
                <Button icon={<Banknote className="size-4" />} onClick={() => setMovement('payments')}>
                  Pagar
                </Button>
              )}
              <IconButton label="Editar empenho" variant="secondary" className="size-10" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
              </IconButton>
            </>
          )
        }
      />

      <section className="card mb-6 p-6">
        <ol className="flex flex-col gap-5 sm:flex-row sm:gap-4">
          <Stage label="Empenhado" value={c.committedAmount} of={base || c.amount} done={c.committedAmount > 0} active />
          <Stage
            label="Liquidado"
            value={c.liquidatedAmount}
            of={base}
            done={base > 0 && c.toLiquidateAmount === 0}
            active={c.liquidatedAmount > 0}
          />
          <Stage
            label="Pago"
            value={c.paidAmount}
            of={base}
            done={base > 0 && c.status === 'PAID'}
            active={c.paidAmount > 0}
            last
          />
        </ol>
        {(c.toLiquidateAmount > 0 || c.toPayAmount > 0 || c.cancelledAmount > 0) && (
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-ink-100 pt-4 text-sm">
            {c.toLiquidateAmount > 0 && (
              <p className="text-ink-500">
                A liquidar <strong className="ml-1 text-amber-700 tabular-nums">{formatMoney(c.toLiquidateAmount)}</strong>
              </p>
            )}
            {c.toPayAmount > 0 && (
              <p className="text-ink-500">
                A pagar <strong className="ml-1 text-brand-700 tabular-nums">{formatMoney(c.toPayAmount)}</strong>
              </p>
            )}
            {c.cancelledAmount > 0 && (
              <p className="text-ink-500">
                Anulado <strong className="ml-1 text-red-600 tabular-nums">{formatMoney(c.cancelledAmount)}</strong>
                <span className="ml-1 text-ink-400">de {formatMoney(c.amount)} originais</span>
              </p>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card title="Dados do empenho">
          <DescriptionList
            items={[
              { label: 'Data do empenho', value: formatDate(c.commitmentDate) },
              { label: 'Valor original', value: <span className="tabular-nums">{formatMoney(c.amount)}</span> },
              {
                label: 'Ação',
                value: (
                  <Link to={`/financeiro/acoes/${c.actionId}`} className="hover:text-brand-700">
                    <CodeTag>{c.actionCode}</CodeTag>
                  </Link>
                ),
              },
              {
                label: 'Subação',
                value: (
                  <Link to={`/financeiro/subacoes/${c.subActionId}`} className="hover:text-brand-700">
                    <CodeTag>{c.subActionCode}</CodeTag>
                  </Link>
                ),
              },
              { label: 'Favorecido', value: c.creditor },
              { label: 'Registrado em', value: formatDateTime(c.createdAt) },
            ]}
          />
          {c.description && (
            <div className="mt-4 border-t border-ink-100 pt-4">
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Objeto</p>
              <p className="mt-1 text-sm whitespace-pre-line text-ink-800">{c.description}</p>
            </div>
          )}
        </Card>

        <Card title="Movimentações" description="Empenho, liquidações, pagamentos e anulações" padded={false}>
          <OperationFeed operations={operations} dense />
        </Card>
      </div>

      <CommitmentMovementModal commitment={c} movement={movement} onClose={() => setMovement(null)} />
      <CommitmentFormModal open={editing} onClose={() => setEditing(false)} commitment={c} />
    </>
  )
}
