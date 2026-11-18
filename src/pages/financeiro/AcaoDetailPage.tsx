import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowLeftRight, FilePlus2, Pencil, Plus, PlusCircle, Shuffle, SplitSquareHorizontal, Trash2 } from 'lucide-react'
import { ApiError, type FinanceSubAction } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useCommitments, useDeleteFinanceAction, useFinanceAction, useFinanceActionHistory } from '@/queries/finance'
import { formatMoney, formatPct } from '@/lib/finance'
import { PageHeader, Tabs } from '@/components/ui/Layout'
import { Button, IconButton } from '@/components/ui/Button'
import { MenuButton } from '@/components/ui/Menu'
import { PeriodFilter } from '@/components/finance/PeriodFilter'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock, PageSkeleton } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { AsOfBanner, AsOfDatePicker, useAsOfDate } from '@/components/finance/AsOfDate'
import { ExecutionBar, ExecutionLegend } from '@/components/finance/ExecutionBar'
import { CodeTag, InactiveBadge, Metric, Money } from '@/components/finance/FinanceUi'
import { ActionFormModal, SubActionFormModal } from '@/components/finance/ActionFormModals'
import { DistributionModal, TacModal, TransferModal } from '@/components/finance/BudgetOperationModals'
import { CommitmentFormModal } from '@/components/finance/CommitmentModals'
import { CommitmentsTable } from '@/components/finance/CommitmentsTable'
import { ActionHistoryTable } from '@/components/finance/HistoryTable'

type Tab = 'subacoes' | 'empenhos' | 'historico'
type ModalKind = 'edit' | 'sub' | 'distribute' | 'tac' | 'transferA' | 'transferB' | 'commitment'

export function AcaoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { financeAccess: access } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [date, setDate] = useAsOfDate()
  const [tab, setTab] = useState<Tab>('subacoes')
  const [modal, setModal] = useState<ModalKind | null>(null)
  const [editSub, setEditSub] = useState<FinanceSubAction | null>(null)
  const [period, setPeriod] = useState({ from: '', to: '' })

  const action = useFinanceAction(id, date)
  const commitments = useCommitments({ actionId: id }, tab === 'empenhos')
  const history = useFinanceActionHistory(id, { from: period.from || undefined, to: period.to || undefined }, tab === 'historico')
  const del = useDeleteFinanceAction()

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo financeiro." />
  if (action.isPending) return <PageSkeleton />
  if (action.isError) return <ErrorState error={action.error} onRetry={() => action.refetch()} />

  const a = action.data
  const qs = date ? `?data=${date}` : ''
  const subs = [...a.subActions].sort((x, y) => x.code.localeCompare(y.code, 'pt-BR', { numeric: true }))
  // Numa posição passada os saldos exibidos não são os atuais: operações só na visão de hoje
  const canOperate = access.canUpdate && a.isActive && !date

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir ação',
      message: (
        <>
          A ação <strong>{a.code}</strong> e suas subações serão excluídas. Só é possível excluir ações sem nenhuma
          movimentação; caso contrário, desative-a.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(a.id)
      toast.success('Ação excluída.')
      navigate('/financeiro')
    } catch (err) {
      toast.error(err instanceof ApiError && err.isConflict ? err.detail : err)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Financeiro', to: `/financeiro${qs}` }, { label: a.code }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {a.name}
            <InactiveBadge active={a.isActive} />
          </span>
        }
        description={
          <span className="flex items-center gap-2">
            <CodeTag>{a.code}</CodeTag>
            {a.description && <span className="truncate">{a.description}</span>}
          </span>
        }
        actions={
          <>
            <AsOfDatePicker value={date} onChange={setDate} />
            {canOperate && (
              <MenuButton
                label="Operação"
                items={[
                  {
                    label: 'Distribuir saldo',
                    description: `${formatMoney(a.undistributedAmount)} a distribuir`,
                    icon: <SplitSquareHorizontal className="size-4" />,
                    onSelect: () => setModal('distribute'),
                    disabled: a.undistributedAmount <= 0 || subs.length === 0,
                  },
                  {
                    label: 'Termo aditivo (TAC)',
                    description: 'Método C · somar valor à ação',
                    icon: <PlusCircle className="size-4" />,
                    onSelect: () => setModal('tac'),
                  },
                  {
                    label: 'Transferir entre subações',
                    description: 'Método A · dentro desta ação',
                    icon: <ArrowLeftRight className="size-4" />,
                    onSelect: () => setModal('transferA'),
                    disabled: subs.length < 2,
                  },
                  {
                    label: 'Transferir entre ações',
                    description: 'Método B · para outra ação',
                    icon: <Shuffle className="size-4" />,
                    onSelect: () => setModal('transferB'),
                  },
                  {
                    label: 'Novo empenho',
                    description: 'Em uma subação desta ação',
                    icon: <FilePlus2 className="size-4" />,
                    onSelect: () => setModal('commitment'),
                    disabled: subs.length === 0,
                  },
                ]}
              />
            )}
            {access.canUpdate && (
              <IconButton label="Editar ação" variant="secondary" className="size-10" onClick={() => setModal('edit')}>
                <Pencil className="size-4" />
              </IconButton>
            )}
            {access.canDelete && (
              <IconButton label="Excluir ação" variant="secondary" className="size-10 hover:text-red-600" onClick={onDelete}>
                <Trash2 className="size-4" />
              </IconButton>
            )}
          </>
        }
      />

      <AsOfBanner date={date} onReset={() => setDate(undefined)} />

      {/* Indicadores */}
      <section className="card mb-6 p-6">
        <div className="grid gap-6 sm:grid-cols-3">
          <Metric label="Valor total" value={a.totalAmount} emphasis />
          <Metric
            label="Distribuído"
            value={a.distributedAmount}
            hint={`${formatPct(a.distributedAmount, a.totalAmount)} em ${subs.length} subaç${subs.length === 1 ? 'ão' : 'ões'}`}
          />
          <div className="flex items-start justify-between gap-3">
            <Metric
              label="Saldo a distribuir"
              value={a.undistributedAmount}
              tone={a.undistributedAmount > 0 ? 'warning' : 'default'}
            />
            {canOperate && a.undistributedAmount > 0 && subs.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setModal('distribute')}>
                Distribuir
              </Button>
            )}
          </div>
        </div>
        <ExecutionBar
          className="mt-6"
          size="lg"
          total={a.totalAmount}
          committed={a.committedAmount}
          liquidated={a.liquidatedAmount}
          paid={a.paidAmount}
        />
        <div className="mt-5">
          <ExecutionLegend
            total={a.totalAmount}
            committed={a.committedAmount}
            liquidated={a.liquidatedAmount}
            paid={a.paidAmount}
            available={a.availableAmount}
          />
        </div>
      </section>

      <div className="card">
        <div className="flex items-center justify-between gap-3 px-5 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'subacoes', label: 'Subações', count: subs.length },
              { value: 'empenhos', label: 'Empenhos' },
              { value: 'historico', label: 'Histórico' },
            ]}
          />
          {tab === 'subacoes' && access.canCreate && a.isActive && (
            <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setModal('sub')}>
              Nova subação
            </Button>
          )}
        </div>

        {tab === 'subacoes' &&
          (subs.length === 0 ? (
            <EmptyState
              title="Nenhuma subação"
              description="Crie subações para repartir o valor da ação e empenhar despesas."
              action={
                access.canCreate &&
                a.isActive && (
                  <Button icon={<Plus className="size-4" />} onClick={() => setModal('sub')}>
                    Nova subação
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Subação</th>
                    <th className="text-right">Dotação</th>
                    <th className="w-48">Execução</th>
                    <th className="text-right">Empenhado</th>
                    <th className="text-right">Pago</th>
                    <th className="text-right">Disponível</th>
                    {access.canUpdate && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className={clsx('row-link', !s.isActive && 'opacity-60')}>
                      <td>
                        <Link to={`/financeiro/subacoes/${s.id}${qs}`} className="group block min-w-48">
                          <span className="flex items-center gap-2">
                            <CodeTag>{s.code}</CodeTag>
                            <InactiveBadge active={s.isActive} />
                          </span>
                          <span className="mt-0.5 block font-medium text-ink-900 group-hover:text-brand-700">{s.name}</span>
                        </Link>
                      </td>
                      <td className="text-right">
                        <Money value={s.balance} className="text-ink-900" />
                        <p className="text-[11px] text-ink-400">{formatPct(s.balance, a.totalAmount)} da ação</p>
                      </td>
                      <td>
                        <ExecutionBar total={s.balance} committed={s.committedAmount} liquidated={s.liquidatedAmount} paid={s.paidAmount} />
                        <p className="mt-1 text-[11px] text-ink-400">{formatPct(s.committedAmount, s.balance)} empenhado</p>
                      </td>
                      <td className="text-right">
                        <Money value={s.committedAmount} />
                      </td>
                      <td className="text-right">
                        <Money value={s.paidAmount} />
                      </td>
                      <td className="text-right">
                        <Money value={s.availableAmount} strong className={s.availableAmount > 0 ? 'text-brand-700' : ''} />
                      </td>
                      {access.canUpdate && (
                        <td>
                          <IconButton
                            label="Editar subação"
                            onClick={() => {
                              setEditSub(s)
                              setModal('sub')
                            }}
                          >
                            <Pencil className="size-4" />
                          </IconButton>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {tab === 'empenhos' &&
          (commitments.isPending ? (
            <LoadingBlock />
          ) : commitments.isError ? (
            <ErrorState error={commitments.error} onRetry={() => commitments.refetch()} />
          ) : commitments.data.length === 0 ? (
            <EmptyState title="Nenhum empenho nesta ação" />
          ) : (
            <CommitmentsTable items={commitments.data} />
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
              <ActionHistoryTable items={history.data} />
            )}
          </>
        )}
      </div>

      <ActionFormModal open={modal === 'edit'} onClose={() => setModal(null)} action={a} />
      <SubActionFormModal
        open={modal === 'sub'}
        onClose={() => {
          setModal(null)
          setEditSub(null)
        }}
        actionId={a.id}
        actionLabel={a.code}
        subAction={editSub}
      />
      <DistributionModal open={modal === 'distribute'} onClose={() => setModal(null)} action={a} />
      <TacModal open={modal === 'tac'} onClose={() => setModal(null)} action={a} />
      <TransferModal
        open={modal === 'transferA' || modal === 'transferB'}
        mode={modal === 'transferB' ? 'B' : 'A'}
        fromSubActionId={subs.find((s) => s.isActive && s.availableAmount > 0)?.id}
        onClose={() => setModal(null)}
      />
      <CommitmentFormModal
        open={modal === 'commitment'}
        onClose={() => setModal(null)}
        subActionId={subs.find((s) => s.isActive && s.availableAmount > 0)?.id}
        onCreated={(c) => navigate(`/financeiro/empenhos/${c.commitment.id}`)}
      />
    </>
  )
}

