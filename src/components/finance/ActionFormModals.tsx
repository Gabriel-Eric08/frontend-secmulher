import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, type FinanceAction, type FinanceSubAction, type UUID } from '@/api'
import { useSaveFinanceAction, useSaveSubAction } from '@/queries/finance'
import { todayISO } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { MoneyInput } from './MoneyInput'
import { OperationDateField } from './FinanceUi'

type Errors = Record<string, string>

/** Erros de campo vão para o formulário; o resto vira toast. */
export function applyApiError(err: unknown, setErrors: (e: Errors) => void, toast: ReturnType<typeof useToast>) {
  if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
  else toast.error(err)
}

// ---------------------------------------------------------------- Ação

export function ActionFormModal({
  open,
  onClose,
  action,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  action?: FinanceAction | null
  onCreated?: (a: FinanceAction) => void
}) {
  const toast = useToast()
  const save = useSaveFinanceAction()
  const isEdit = !!action
  const [form, setForm] = useState({ code: '', name: '', description: '', isActive: true })
  const [initialAmount, setInitialAmount] = useState<number | null>(null)
  const [initialDate, setInitialDate] = useState(todayISO())
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm({
      code: action?.code ?? '',
      name: action?.name ?? '',
      description: action?.description ?? '',
      isActive: action?.isActive ?? true,
    })
    setInitialAmount(null)
    setInitialDate(todayISO())
  }, [open, action])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!form.code.trim()) errs.code = 'Informe o código.'
    if (!form.name.trim()) errs.name = 'Informe o nome.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const base = { code: form.code.trim(), name: form.name.trim(), description: form.description.trim() || undefined }
    try {
      if (action) {
        await save.mutateAsync({ id: action.id, body: { ...base, isActive: form.isActive } })
        toast.success('Ação atualizada.')
      } else {
        const created = await save.mutateAsync({
          body: { ...base, initialAmount: initialAmount ?? undefined, initialDate: initialAmount ? initialDate : undefined },
        })
        toast.success('Ação criada.')
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
      title={isEdit ? 'Editar ação' : 'Nova ação orçamentária'}
      description={isEdit ? 'O valor da ação só muda por operações, que ficam no histórico.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="fin-action-form" loading={save.isPending}>
            {isEdit ? 'Salvar' : 'Criar ação'}
          </Button>
        </>
      }
    >
      <form id="fin-action-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <Field label="Código" htmlFor="fa-code" required error={errors.code}>
            <Input
              id="fa-code"
              value={form.code}
              maxLength={50}
              invalid={!!errors.code}
              className="font-mono"
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </Field>
          <Field label="Nome" htmlFor="fa-name" required error={errors.name}>
            <Input
              id="fa-name"
              value={form.name}
              maxLength={255}
              invalid={!!errors.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Descrição" htmlFor="fa-desc" error={errors.description}>
          <Textarea
            id="fa-desc"
            value={form.description}
            maxLength={2000}
            className="min-h-20"
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Field>

        {isEdit ? (
          <Checkbox
            label="Ativa"
            description="Ações inativas não recebem empenhos, transferências, TAC nem distribuição."
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
        ) : (
          <div className="grid gap-4 rounded-lg border border-dashed border-ink-200 p-4 sm:grid-cols-2">
            <Field
              label="Valor inicial"
              htmlFor="fa-amount"
              error={errors.initialAmount}
              hint="Opcional. Entra como saldo a distribuir."
            >
              <MoneyInput id="fa-amount" value={initialAmount} onChange={setInitialAmount} invalid={!!errors.initialAmount} />
            </Field>
            {initialAmount ? (
              <OperationDateField
                id="fa-date"
                label="Data do valor inicial"
                value={initialDate}
                onChange={setInitialDate}
                error={errors.initialDate}
              />
            ) : null}
          </div>
        )}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Subação

export function SubActionFormModal({
  open,
  onClose,
  actionId,
  actionLabel,
  subAction,
}: {
  open: boolean
  onClose: () => void
  actionId: UUID
  actionLabel?: string
  subAction?: FinanceSubAction | null
}) {
  const toast = useToast()
  const save = useSaveSubAction()
  const isEdit = !!subAction
  const [form, setForm] = useState({ code: '', name: '', description: '', isActive: true })
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm({
      code: subAction?.code ?? '',
      name: subAction?.name ?? '',
      description: subAction?.description ?? '',
      isActive: subAction?.isActive ?? true,
    })
  }, [open, subAction])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!form.code.trim()) errs.code = 'Informe o código.'
    if (!form.name.trim()) errs.name = 'Informe o nome.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await save.mutateAsync({
        id: subAction?.id,
        actionId,
        body: {
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          isActive: form.isActive,
        },
      })
      toast.success(isEdit ? 'Subação atualizada.' : 'Subação criada.')
      onClose()
    } catch (err) {
      applyApiError(err, setErrors, toast)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar subação' : 'Nova subação'}
      description={
        isEdit
          ? 'A dotação só muda por operações.'
          : `${actionLabel ? `Em ${actionLabel}. ` : ''}Nasce com dotação zero; o valor chega por distribuição, TAC ou transferência.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="fin-sub-form" loading={save.isPending}>
            {isEdit ? 'Salvar' : 'Criar subação'}
          </Button>
        </>
      }
    >
      <form id="fin-sub-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <Field label="Código" htmlFor="fs-code" required error={errors.code} hint="Único no sistema.">
            <Input
              id="fs-code"
              value={form.code}
              maxLength={50}
              className="font-mono"
              invalid={!!errors.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </Field>
          <Field label="Nome" htmlFor="fs-name" required error={errors.name}>
            <Input
              id="fs-name"
              value={form.name}
              maxLength={255}
              invalid={!!errors.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Descrição" htmlFor="fs-desc" error={errors.description}>
          <Textarea
            id="fs-desc"
            value={form.description}
            maxLength={2000}
            className="min-h-20"
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Field>
        {isEdit && (
          <Checkbox
            label="Ativa"
            description="Subações inativas não recebem empenhos nem transferências; empenhos existentes seguem normalmente."
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
        )}
      </form>
    </Modal>
  )
}
