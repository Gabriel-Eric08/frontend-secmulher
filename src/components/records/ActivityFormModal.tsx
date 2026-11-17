import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import type { ManualActivityType, RecordKind, UUID } from '@/api'
import { ACTIVITY_ICONS, MANUAL_STYLE } from './Timeline'
import { ApiError } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useAddActivity } from '@/queries/records'
import { ACTIVITY_LABEL, MANUAL_ACTIVITY_TYPES, nowLocalInput } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'

const TYPE_HINT: Record<ManualActivityType, string> = {
  TRIAGE: 'Primeira escuta e avaliação da demanda',
  SERVICE: 'Atendimento realizado pela equipe',
  FOLLOW_UP: 'Retorno, visita ou contato de acompanhamento',
  NOTE: 'Observação interna sobre o caso',
}

export function ActivityFormModal({
  open,
  onClose,
  kind,
  recordId,
}: {
  open: boolean
  onClose: () => void
  kind: RecordKind
  recordId: UUID
}) {
  const { user } = useAuth()
  const toast = useToast()
  const add = useAddActivity(kind, recordId)
  const [actionType, setActionType] = useState<ManualActivityType>('SERVICE')
  const [description, setDescription] = useState('')
  const [responsible, setResponsible] = useState(user?.name ?? '')
  const [occurredAt, setOccurredAt] = useState(nowLocalInput())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const reset = () => {
    setActionType('SERVICE')
    setDescription('')
    setResponsible(user?.name ?? '')
    setOccurredAt(nowLocalInput())
    setErrors({})
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return setErrors({ description: 'Descreva o atendimento.' })
    try {
      await add.mutateAsync({
        actionType,
        description: description.trim(),
        responsibleEmployee: responsible.trim() || undefined,
        // backend espera data/hora local ISO sem fuso (ex.: 2026-11-17T10:00:00)
        occurredAt: occurredAt ? `${occurredAt}:00` : undefined,
      })
      toast.success('Registro adicionado à linha do tempo.')
      reset()
      onClose()
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo registro na linha do tempo"
      description="O registro fica permanente na linha do tempo e não pode ser editado."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="activity-form" loading={add.isPending}>
            Registrar
          </Button>
        </>
      }
    >
      <form id="activity-form" onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="label">
            Tipo de registro <span className="text-red-600">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {MANUAL_ACTIVITY_TYPES.map((t) => {
              const Icon = ACTIVITY_ICONS[t]
              const active = actionType === t
              return (
                <label
                  key={t}
                  className={clsx(
                    'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors',
                    active ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-ink-200 hover:border-ink-300',
                  )}
                >
                  <input
                    type="radio"
                    name="act-type"
                    value={t}
                    checked={active}
                    onChange={() => setActionType(t)}
                    className="sr-only"
                  />
                  <span className={clsx('flex size-7 shrink-0 items-center justify-center rounded-full', MANUAL_STYLE[t].icon)}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink-900">{ACTIVITY_LABEL[t]}</span>
                    <span className="block text-xs leading-snug text-ink-500">{TYPE_HINT[t]}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
        <Field label="Descrição" htmlFor="act-desc" required error={errors.description}>
          <Textarea
            id="act-desc"
            rows={5}
            value={description}
            invalid={!!errors.description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Resumo do atendimento, encaminhamentos, observações…"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Profissional responsável" htmlFor="act-resp" error={errors.responsibleEmployee}>
            <Input id="act-resp" value={responsible} onChange={(e) => setResponsible(e.target.value)} />
          </Field>
          <Field label="Data e hora" htmlFor="act-when" error={errors.occurredAt} hint="Não pode ser no futuro">
            <Input
              id="act-when"
              type="datetime-local"
              value={occurredAt}
              max={nowLocalInput()}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </Field>
        </div>
      </form>
    </Modal>
  )
}
