import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, FilePlus2, Pencil, Trash2 } from 'lucide-react'
import { ApiError } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import {
  useCommitments,
  useDeleteSubAction,
  useFinanceAction,
  useFinanceSubAction,
  useFinanceSubActionHistory,
} from '@/queries/finance'
import { formatPct } from '@/lib/finance'
import { PageHeader, Tabs } from '@/components/ui/Layout'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock, PageSkeleton } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { AsOfBanner, AsOfDatePicker, useAsOfDate } from '@/components/finance/AsOfDate'
import { ExecutionBar, ExecutionLegend } from '@/components/finance/ExecutionBar'
import { CodeTag, InactiveBadge, Metric } from '@/components/finance/FinanceUi'
import { SubActionFormModal } from '@/components/finance/ActionFormModals'
import { TransferModal } from '@/components/finance/BudgetOperationModals'
import { CommitmentFormModal } from '@/components/finance/CommitmentModals'
import { CommitmentsTable } from '@/components/finance/CommitmentsTable'
import { SubActionHistoryTable } from '@/components/finance/HistoryTable'
import { PeriodFilter } from '@/components/finance/PeriodFilter'

type Tab = 'empenhos' | 'historico'

export function SubacaoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { financeAccess: access } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [date, setDate] = useAsOfDate()
  const [tab, setTab] = useState<Tab>('empenhos')
  const [modal, setModal] = useState<null | 'edit' | 'transfer' | 'commitment'>(null)
  const [period, setPeriod] = useState({ from: '', to: '' })

  const sub = useFinanceSubAction(id, date)
  const action = useFinanceAction(sub.data?.actionId, date)
  const commitments = useCommitments({ subActionId: id }, tab === 'empenhos')
  const history = useFinanceSubActionHistory(
    id,
    { from: period.from || undefined, to: period.to || undefined },
    tab === 'historico',
  )
  const del = useDeleteSubAction()

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo financeiro." />
  if (sub.isPending) return <PageSkeleton />
  if (sub.isError) return <ErrorState error={sub.error} onRetry={() => sub.refetch()} />

  const s = sub.data
  const qs = date ? `?data=${date}` : ''
  const actionActive = action.data?.isActive ?? true
  // Numa posição passada os saldos exibidos não são os atuais: operações só na visão de hoje
  const canOperate = access.canUpdate && s.isActive && actionActive && !date

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir subação',
      message: (
        <>
          A subação <strong>{s.code}</strong> será excluída. Só é possível excluir subações sem movimentação; caso
          contrário, desative-a.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(s.id)
      toast.success('Subação excluída.')
      navigate(`/financeiro/acoes/${s.actionId}`)
    } catch (err) {
      toast.error(err instanceof ApiError && err.isConflict ? err.detail : err)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Financeiro', to: `/financeiro${qs}` },
          { label: s.actionCode, to: `/financeiro/acoes/${s.actionId}${qs}` },
          { label: s.code },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {s.name}
            <InactiveBadge active={s.isActive} />
          </span>
        }
        description={
          <span className="flex items-center gap-2">
            <CodeTag>{s.code}</CodeTag>
            {action.data && <span className="truncate">em {action.data.name}</span>}
          </span>
        }
        actions={
          <>
            <AsOfDatePicker value={date} onChange={setDate} />
            {canOperate && (
              <>
                <Button
                  variant="secondary"
                  icon={<ArrowLeftRight className="size-4" />}
                  onClick={() => setModal('transfer')}
                  disabled={s.availableAmount <= 0}
                >
                  Transferir
                </Button>
                <Button icon={<FilePlus2 className="size-4" />} onClick={() => setModal('commitment')}>
                  Empenhar
                </Button>
              </>
            )}
            {access.canUpdate && (
              <IconButton label="Editar subação" variant="secondary" className="size-10" onClick={() => setModal('edit')}>
                <Pencil className="size-4" />
              </IconButton>
            )}
            {access.canDelete && (
              <IconButton label="Excluir subação" variant="secondary" className="size-10 hover:text-red-600" onClick={onDelete}>
                <Trash2 className="size-4" />
              </IconButton>
            )}
          </>
        }
      />

      <AsOfBanner date={date} onReset={() => setDate(undefined)} />

      {s.description && <p className="-mt-2 mb-6 max-w-3xl text-sm whitespace-pre-line text-ink-600">{s.description}</p>}

      <section className="card mb-6 p-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <Metric
            label="Dotação"
            value={s.balance}
            emphasis
            hint={action.data ? `${formatPct(s.balance, action.data.totalAmount)} da ação` : undefined}
          />
          <Metric label="Empenhado" value={s.committedAmount} hint={`${formatPct(s.committedAmount, s.balance)} da dotação`} />
          <Metric label="Disponível" value={s.availableAmount} tone="brand" hint="Pode ser empenhado ou transferido" />
        </div>
        <ExecutionBar
          className="mt-6"
          size="lg"
          total={s.balance}
          committed={s.committedAmount}
          liquidated={s.liquidatedAmount}
          paid={s.paidAmount}
        />
        <div className="mt-5">
          <ExecutionLegend
            total={s.balance}
            committed={s.committedAmount}
            liquidated={s.liquidatedAmount}
            paid={s.paidAmount}
            available={s.availableAmount}
          />
        </div>
      </section>

      <div className="card">
        <div className="px-5 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'empenhos', label: 'Empenhos' },
              { value: 'historico', label: 'Histórico' },
            ]}
          />
        </div>

        {tab === 'empenhos' &&
          (commitments.isPending ? (
            <LoadingBlock />
          ) : commitments.isError ? (
            <ErrorState error={commitments.error} onRetry={() => commitments.refetch()} />
          ) : commitments.data.length === 0 ? (
            <EmptyState
              title="Nenhum empenho nesta subação"
              action={
                canOperate &&
                s.availableAmount > 0 && (
                  <Button icon={<FilePlus2 className="size-4" />} onClick={() => setModal('commitment')}>
                    Empenhar
                  </Button>
                )
              }
            />
          ) : (
            <CommitmentsTable items={commitments.data} showSubAction={false} />
          ))}

        {tab === 'historico' && (
          <>
            <PeriodFilter value={period} onChange={setPeriod} />
            {history.isPending ? (
              <LoadingBlock />
            ) : history.isError ? (
              <ErrorState error={history.error} onRetry={() => history.refetch()} />
            ) : history.data.length === 0 ? (
              <EmptyState title="Nenhuma operação no período" />
            ) : (
              <SubActionHistoryTable items={history.data} />
            )}
          </>
        )}
      </div>

      <SubActionFormModal open={modal === 'edit'} onClose={() => setModal(null)} actionId={s.actionId} subAction={s} />
      <TransferModal open={modal === 'transfer'} onClose={() => setModal(null)} fromSubActionId={s.id} />
      <CommitmentFormModal
        open={modal === 'commitment'}
        onClose={() => setModal(null)}
        subActionId={s.id}
        onCreated={(c) => navigate(`/financeiro/empenhos/${c.commitment.id}`)}
      />
    </>
  )
}
