import { useEffect, useMemo, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { ArrowDown } from 'lucide-react'
import type { FinanceAction, FinanceSubAction } from '@/api'
import { useDistribute, useFinanceDashboard, useTac, useTransfer } from '@/queries/finance'
import { formatMoney, subMoney, sumMoney } from '@/lib/finance'
import { todayISO } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Switch, Textarea } from '@/components/ui/Form'
import { Alert } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { MoneyInput } from './MoneyInput'
import { CodeTag, ImpactBox, ImpactRow, OperationDateField, SubActionSelect } from './FinanceUi'
import { applyApiError } from './ActionFormModals'

type Errors = Record<string, string>
type Amounts = Record<string, number | null>

function toAllocations(amounts: Amounts) {
  return Object.entries(amounts)
    .filter(([, v]) => v && v > 0)
    .map(([subActionId, amount]) => ({ subActionId, amount: amount! }))
}

// ---------------------------------------------------------------- Editor de alocações

function AllocationEditor({
  subActions,
  amounts,
  onChange,
  pool,
}: {
  subActions: FinanceSubAction[]
  amounts: Amounts
  onChange: (a: Amounts) => void
  /** Quanto há para repartir (para o botão "restante") */
  pool: number
}) {
  const allocated = sumMoney(Object.values(amounts))
  const remaining = subMoney(pool, allocated)
  if (subActions.length === 0) {
    return <p className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-500">A ação não tem subações ativas.</p>
  }
  return (
    <div className="divide-y divide-ink-100 rounded-lg border border-ink-200">
      {subActions.map((s) => (
        <div key={s.id} className="flex items-center gap-3 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink-800">
              <CodeTag className="mr-1.5">{s.code}</CodeTag>
              {s.name}
            </p>
            <p className="text-[11px] text-ink-400 tabular-nums">Dotação atual {formatMoney(s.balance)}</p>
          </div>
          {remaining > 0 && (
            <button
              type="button"
              className="hidden text-[11px] font-medium text-brand-700 hover:underline sm:block"
              onClick={() => onChange({ ...amounts, [s.id]: sumMoney([amounts[s.id], remaining]) })}
            >
              + restante
            </button>
          )}
          <MoneyInput
            className="w-40 shrink-0"
            value={amounts[s.id] ?? null}
            onChange={(v) => onChange({ ...amounts, [s.id]: v })}
          />
        </div>
      ))}
    </div>
  )
}

function Footer({ onClose, form, loading, label }: { onClose: () => void; form: string; loading: boolean; label: string }) {
  return (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" form={form} loading={loading}>
        {label}
      </Button>
    </>
  )
}

function DescriptionField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field label="Justificativa" htmlFor="op-desc" error={error}>
      <Textarea
        id="op-desc"
        value={value}
        maxLength={2000}
        className="min-h-16"
        placeholder="Motivo, processo, ofício…"
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

// ---------------------------------------------------------------- Distribuição

export function DistributionModal({ open, onClose, action }: { open: boolean; onClose: () => void; action: FinanceAction }) {
  const toast = useToast()
  const distribute = useDistribute()
  const [amounts, setAmounts] = useState<Amounts>({})
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const subs = action.subActions.filter((s) => s.isActive)

  useEffect(() => {
    if (!open) return
    setAmounts({})
    setDate(todayISO())
    setDescription('')
    setErrors({})
  }, [open])

  const allocated = sumMoney(Object.values(amounts))
  const remaining = subMoney(action.undistributedAmount, allocated)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const allocations = toAllocations(amounts)
    if (allocations.length === 0) return toast.error('Informe o valor de ao menos uma subação.')
    if (remaining < 0) return toast.error('O total distribuído passa do saldo a distribuir.')
    try {
      await distribute.mutateAsync({ actionId: action.id, allocations, description: description.trim() || undefined, date })
      toast.success(`${formatMoney(allocated)} distribuídos.`)
      onClose()
    } catch (err) {
      applyApiError(err, setErrors, toast)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Distribuir saldo"
      description={`Reparte o saldo a distribuir de ${action.code} entre as subações.`}
      footer={<Footer onClose={onClose} form="dist-form" loading={distribute.isPending} label="Distribuir" />}
    >
      <form id="dist-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-baseline justify-between rounded-lg bg-brand-50 px-4 py-3">
          <span className="text-sm text-brand-900">Saldo a distribuir</span>
          <span className="text-lg font-semibold text-brand-800 tabular-nums">{formatMoney(action.undistributedAmount)}</span>
        </div>
        <AllocationEditor subActions={subs} amounts={amounts} onChange={setAmounts} pool={action.undistributedAmount} />
        <div className="flex justify-between px-1 text-sm">
          <span className="text-ink-500">
            Distribuindo <strong className="text-ink-900 tabular-nums">{formatMoney(allocated)}</strong>
          </span>
          <span className={clsx('tabular-nums', remaining < 0 ? 'font-semibold text-red-600' : 'text-ink-500')}>
            Fica a distribuir {formatMoney(remaining)}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <OperationDateField value={date} onChange={setDate} error={errors.date} />
          <DescriptionField value={description} onChange={setDescription} error={errors.description} />
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- TAC (Método C)

export function TacModal({ open, onClose, action }: { open: boolean; onClose: () => void; action: FinanceAction }) {
  const toast = useToast()
  const tac = useTac()
  const [amount, setAmount] = useState<number | null>(null)
  const [allocate, setAllocate] = useState(false)
  const [amounts, setAmounts] = useState<Amounts>({})
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const subs = action.subActions.filter((s) => s.isActive)

  useEffect(() => {
    if (!open) return
    setAmount(null)
    setAllocate(false)
    setAmounts({})
    setDate(todayISO())
    setDescription('')
    setErrors({})
  }, [open])

  const allocated = allocate ? sumMoney(Object.values(amounts)) : 0
  const leftover = subMoney(amount ?? 0, allocated)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!amount) return setErrors({ amount: 'Informe o valor do TAC.' })
    if (leftover < 0) return toast.error('As alocações somam mais que o valor do TAC.')
    try {
      await tac.mutateAsync({
        actionId: action.id,
        amount,
        allocations: allocate ? toAllocations(amounts) : undefined,
        description: description.trim() || undefined,
        date,
      })
      toast.success(`TAC de ${formatMoney(amount)} registrado.`)
      onClose()
    } catch (err) {
      applyApiError(err, setErrors, toast)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Termo aditivo (TAC)"
      description={`Método C: soma valor a ${action.code}. O que não for alocado fica a distribuir.`}
      footer={<Footer onClose={onClose} form="tac-form" loading={tac.isPending} label="Registrar TAC" />}
    >
      <form id="tac-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor do aditivo" htmlFor="tac-amount" required error={errors.amount}>
            <MoneyInput id="tac-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
          </Field>
          <OperationDateField value={date} onChange={setDate} error={errors.date} />
        </div>

        <Switch checked={allocate} onChange={setAllocate} label="Alocar já em subações" disabled={subs.length === 0} />
        {allocate && <AllocationEditor subActions={subs} amounts={amounts} onChange={setAmounts} pool={amount ?? 0} />}

        <ImpactBox>
          <ImpactRow label="Valor total da ação" before={action.totalAmount} after={sumMoney([action.totalAmount, amount])} />
          <ImpactRow
            label="Saldo a distribuir"
            before={action.undistributedAmount}
            after={sumMoney([action.undistributedAmount, leftover])}
          />
        </ImpactBox>

        <DescriptionField value={description} onChange={setDescription} error={errors.description} />
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Transferências (Métodos A e B)

type Mode = 'A' | 'B'

export function TransferModal({
  open,
  onClose,
  fromSubActionId,
  mode: initialMode = 'A',
}: {
  open: boolean
  onClose: () => void
  fromSubActionId?: string
  mode?: Mode
}) {
  const toast = useToast()
  const transfer = useTransfer()
  const dashboard = useFinanceDashboard(undefined, open)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setFrom(fromSubActionId ?? '')
    setTo('')
    setAmount(null)
    setDate(todayISO())
    setDescription('')
    setErrors({})
  }, [open, fromSubActionId, initialMode])

  const actions = useMemo(() => (dashboard.data?.actions ?? []).filter((a) => a.isActive), [dashboard.data])
  const allSubs = useMemo(() => actions.flatMap((a) => a.subActions), [actions])
  const fromSub = allSubs.find((s) => s.id === from)
  const toSub = allSubs.find((s) => s.id === to)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!from) errs.fromSubActionId = 'Selecione a origem.'
    if (!to) errs.toSubActionId = 'Selecione o destino.'
    if (!amount) errs.amount = 'Informe o valor.'
    else if (fromSub && amount > fromSub.availableAmount) errs.amount = 'Maior que o disponível da origem.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await transfer.mutateAsync({
        crossAction: mode === 'B',
        body: { fromSubActionId: from, toSubActionId: to, amount: amount!, description: description.trim() || undefined, date },
      })
      toast.success(`${formatMoney(amount)} transferidos.`)
      onClose()
    } catch (err) {
      applyApiError(err, setErrors, toast)
    }
  }

  const modes: { value: Mode; label: string; hint: string }[] = [
    { value: 'A', label: 'Entre subações', hint: 'Método A · mesma ação' },
    { value: 'B', label: 'Entre ações', hint: 'Método B · muda o total das ações' },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Transferir dotação"
      description="Move valor disponível (dotação − empenhado) de uma subação para outra."
      footer={<Footer onClose={onClose} form="transfer-form" loading={transfer.isPending} label="Transferir" />}
    >
      <form id="transfer-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink-100 p-1" role="radiogroup">
          {modes.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              onClick={() => {
                setMode(m.value)
                setTo('')
              }}
              className={clsx(
                'rounded-md px-3 py-2 text-left transition-all',
                mode === m.value ? 'bg-surface shadow-sm' : 'text-ink-500 hover:text-ink-800',
              )}
            >
              <span className="block text-sm font-medium">{m.label}</span>
              <span className="block text-[11px] text-ink-400">{m.hint}</span>
            </button>
          ))}
        </div>

        {dashboard.isError && <Alert tone="danger">Não foi possível carregar as subações.</Alert>}

        <Field label="Origem" htmlFor="tr-from" required error={errors.fromSubActionId}>
          <SubActionSelect
            id="tr-from"
            actions={actions}
            value={from}
            invalid={!!errors.fromSubActionId}
            disabled={dashboard.isPending}
            placeholder={dashboard.isPending ? 'Carregando…' : 'Selecione a subação de origem…'}
            filter={(s) => s.isActive}
            onChange={(id) => {
              setFrom(id)
              setTo('')
            }}
          />
        </Field>

        <div className="flex justify-center text-ink-300">
          <ArrowDown className="size-5" />
        </div>

        <Field label="Destino" htmlFor="tr-to" required error={errors.toSubActionId}>
          <SubActionSelect
            id="tr-to"
            actions={actions}
            value={to}
            invalid={!!errors.toSubActionId}
            disabled={!fromSub}
            placeholder={fromSub ? 'Selecione a subação de destino…' : 'Escolha a origem primeiro'}
            filter={(s) =>
              s.isActive && s.id !== from && !!fromSub && (mode === 'A' ? s.actionId === fromSub.actionId : s.actionId !== fromSub.actionId)
            }
            onChange={setTo}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Valor"
            htmlFor="tr-amount"
            required
            error={errors.amount}
            hint={
              fromSub && (
                <button
                  type="button"
                  className="font-medium text-brand-700 hover:underline"
                  onClick={() => setAmount(fromSub.availableAmount)}
                >
                  Usar todo o disponível ({formatMoney(fromSub.availableAmount)})
                </button>
              )
            }
          >
            <MoneyInput id="tr-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
          </Field>
          <OperationDateField value={date} onChange={setDate} error={errors.date} />
        </div>

        {fromSub && toSub && (
          <ImpactBox title="Disponível depois">
            <ImpactRow
              label={<>Origem <CodeTag>{fromSub.code}</CodeTag></>}
              before={fromSub.availableAmount}
              after={subMoney(fromSub.availableAmount, amount ?? 0)}
            />
            <ImpactRow
              label={<>Destino <CodeTag>{toSub.code}</CodeTag></>}
              before={toSub.availableAmount}
              after={sumMoney([toSub.availableAmount, amount])}
            />
          </ImpactBox>
        )}

        <DescriptionField value={description} onChange={setDescription} error={errors.description} />
      </form>
    </Modal>
  )
}
