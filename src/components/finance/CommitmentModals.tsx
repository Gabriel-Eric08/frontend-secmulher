import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Commitment, CommitmentDetail, CommitmentMovement } from '@/api'
import { useCommitmentMovement, useCreateCommitment, useFinanceDashboard, useUpdateCommitment } from '@/queries/finance'
import { formatMoney, subMoney, sumMoney } from '@/lib/finance'
import { formatDate, todayISO } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { MoneyInput } from './MoneyInput'
import { ImpactBox, ImpactRow, OperationDateField, SubActionSelect } from './FinanceUi'
import { applyApiError } from './ActionFormModals'

type Errors = Record<string, string>

// ---------------------------------------------------------------- Novo empenho / edição

export function CommitmentFormModal({
  open,
  onClose,
  commitment,
  subActionId: presetSub,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  commitment?: Commitment | null
  subActionId?: string
  onCreated?: (c: CommitmentDetail) => void
}) {
  const toast = useToast()
  const create = useCreateCommitment()
  const update = useUpdateCommitment()
  const isEdit = !!commitment
  const dashboard = useFinanceDashboard(undefined, open && !isEdit)
  const [form, setForm] = useState({ subActionId: '', number: '', creditor: '', description: '' })
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm({
      subActionId: commitment?.subActionId ?? presetSub ?? '',
      number: commitment?.number ?? '',
      creditor: commitment?.creditor ?? '',
      description: commitment?.description ?? '',
    })
    setAmount(null)
    setDate(todayISO())
  }, [open, commitment, presetSub])

  const actions = useMemo(() => (dashboard.data?.actions ?? []).filter((a) => a.isActive), [dashboard.data])
  const sub = actions.flatMap((a) => a.subActions).find((s) => s.id === form.subActionId)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!isEdit && !form.subActionId) errs.subActionId = 'Selecione a subação.'
    if (!form.number.trim()) errs.number = 'Informe o número da nota de empenho.'
    if (!form.creditor.trim()) errs.creditor = 'Informe o favorecido.'
    if (!isEdit) {
      if (!amount) errs.amount = 'Informe o valor.'
      else if (sub && amount > sub.availableAmount) errs.amount = 'Maior que o disponível da subação.'
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    const base = {
      number: form.number.trim(),
      creditor: form.creditor.trim(),
      description: form.description.trim() || undefined,
    }
    try {
      if (commitment) {
        await update.mutateAsync({ id: commitment.id, body: base })
        toast.success('Empenho atualizado.')
      } else {
        const created = await create.mutateAsync({ ...base, subActionId: form.subActionId, amount: amount!, date })
        toast.success(`Empenho ${created.commitment.number} registrado.`)
        onCreated?.(created)
      }
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
      title={isEdit ? 'Editar empenho' : 'Novo empenho'}
      description={isEdit ? 'O valor só muda por anulação.' : 'Reserva parte do disponível de uma subação para um favorecido.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="commit-form" loading={create.isPending || update.isPending}>
            {isEdit ? 'Salvar' : 'Empenhar'}
          </Button>
        </>
      }
    >
      <form id="commit-form" onSubmit={submit} className="space-y-4">
        {!isEdit && (
          <Field label="Subação" htmlFor="cm-sub" required error={errors.subActionId}>
            <SubActionSelect
              id="cm-sub"
              actions={actions}
              value={form.subActionId}
              invalid={!!errors.subActionId}
              disabled={dashboard.isPending}
              placeholder={dashboard.isPending ? 'Carregando…' : 'Selecione a subação…'}
              filter={(s) => s.isActive}
              onChange={(id) => setForm((f) => ({ ...f, subActionId: id }))}
            />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nº da nota de empenho" htmlFor="cm-number" required error={errors.number}>
            <Input
              id="cm-number"
              value={form.number}
              maxLength={50}
              placeholder="2026NE000123"
              className="font-mono"
              invalid={!!errors.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
            />
          </Field>
          <Field label="Favorecido" htmlFor="cm-creditor" required error={errors.creditor}>
            <Input
              id="cm-creditor"
              value={form.creditor}
              maxLength={255}
              invalid={!!errors.creditor}
              onChange={(e) => setForm((f) => ({ ...f, creditor: e.target.value }))}
            />
          </Field>
        </div>
        {!isEdit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Valor"
              htmlFor="cm-amount"
              required
              error={errors.amount}
              hint={sub && <>Disponível: {formatMoney(sub.availableAmount)}</>}
            >
              <MoneyInput id="cm-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
            </Field>
            <OperationDateField label="Data do empenho" value={date} onChange={setDate} error={errors.date} />
          </div>
        )}
        <Field label="Objeto" htmlFor="cm-desc" error={errors.description}>
          <Textarea
            id="cm-desc"
            value={form.description}
            maxLength={2000}
            className="min-h-20"
            placeholder="O que está sendo contratado ou adquirido"
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Field>
        {!isEdit && sub && amount ? (
          <ImpactBox>
            <ImpactRow label={`Disponível de ${sub.code}`} before={sub.availableAmount} after={subMoney(sub.availableAmount, amount)} />
          </ImpactBox>
        ) : null}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Liquidação, pagamento e anulação

const MOVEMENT: Record<
  CommitmentMovement,
  { title: string; verb: string; done: string; limitLabel: string; limit: (c: Commitment) => number; hint: string }
> = {
  liquidations: {
    title: 'Liquidar empenho',
    verb: 'Liquidar',
    done: 'Liquidação registrada.',
    limitLabel: 'A liquidar',
    limit: (c) => c.toLiquidateAmount,
    hint: 'Reconhece que a despesa é devida (ex.: entrega conferida).',
  },
  payments: {
    title: 'Registrar pagamento',
    verb: 'Pagar',
    done: 'Pagamento registrado.',
    limitLabel: 'A pagar',
    limit: (c) => c.toPayAmount,
    hint: 'Saída do dinheiro; só até o valor liquidado.',
  },
  cancellations: {
    title: 'Anular empenho',
    verb: 'Anular',
    done: 'Anulação registrada.',
    limitLabel: 'Anulável (não liquidado)',
    limit: (c) => c.toLiquidateAmount,
    hint: 'Cancela a parte ainda não liquidada; o valor volta ao disponível da subação.',
  },
}

export function CommitmentMovementModal({
  commitment,
  movement,
  onClose,
}: {
  commitment: Commitment
  movement: CommitmentMovement | null
  onClose: () => void
}) {
  const toast = useToast()
  const move = useCommitmentMovement()
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!movement) return
    setAmount(null)
    setDate(todayISO())
    setDescription('')
    setErrors({})
  }, [movement])

  if (!movement) return null
  const cfg = MOVEMENT[movement]
  const limit = cfg.limit(commitment)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!amount) return setErrors({ amount: 'Informe o valor.' })
    if (amount > limit) return setErrors({ amount: `Máximo de ${formatMoney(limit)}.` })
    try {
      await move.mutateAsync({
        id: commitment.id,
        movement,
        body: { amount, description: description.trim() || undefined, date },
      })
      toast.success(cfg.done)
      onClose()
    } catch (err) {
      applyApiError(err, setErrors, toast)
    }
  }

  const v = amount ?? 0
  return (
    <Modal
      open
      onClose={onClose}
      title={cfg.title}
      description={cfg.hint}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="move-form"
            variant={movement === 'cancellations' ? 'danger' : 'primary'}
            loading={move.isPending}
          >
            {cfg.verb}
          </Button>
        </>
      }
    >
      <form id="move-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-baseline justify-between rounded-lg bg-ink-50 px-4 py-3">
          <span className="text-sm text-ink-600">
            {cfg.limitLabel} · <span className="font-mono">{commitment.number}</span>
          </span>
          <span className="text-lg font-semibold text-ink-900 tabular-nums">{formatMoney(limit)}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Valor"
            htmlFor="mv-amount"
            required
            error={errors.amount}
            hint={
              limit > 0 && (
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setAmount(limit)}>
                  Valor total ({formatMoney(limit)})
                </button>
              )
            }
          >
            <MoneyInput id="mv-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
          </Field>
          <Field
            label="Data"
            htmlFor="mv-date"
            error={errors.date}
            hint={`Entre ${formatDate(commitment.commitmentDate)} (empenho) e hoje.`}
          >
            <Input
              id="mv-date"
              type="date"
              value={date}
              min={commitment.commitmentDate}
              max={todayISO()}
              invalid={!!errors.date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        {amount ? (
          <ImpactBox>
            {movement === 'liquidations' && (
              <>
                <ImpactRow label="Liquidado" before={commitment.liquidatedAmount} after={sumMoney([commitment.liquidatedAmount, v])} />
                <ImpactRow label="A pagar" before={commitment.toPayAmount} after={sumMoney([commitment.toPayAmount, v])} />
              </>
            )}
            {movement === 'payments' && (
              <ImpactRow label="Pago" before={commitment.paidAmount} after={sumMoney([commitment.paidAmount, v])} />
            )}
            {movement === 'cancellations' && (
              <ImpactRow label="Empenhado" before={commitment.committedAmount} after={subMoney(commitment.committedAmount, v)} />
            )}
          </ImpactBox>
        ) : null}
        <Field label="Descrição" htmlFor="mv-desc" error={errors.description}>
          <Textarea
            id="mv-desc"
            value={description}
            maxLength={2000}
            className="min-h-16"
            placeholder={movement === 'payments' ? 'Ordem bancária, documento…' : 'Nota fiscal, motivo…'}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}

