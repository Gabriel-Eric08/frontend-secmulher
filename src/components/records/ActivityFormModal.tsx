import { useState, type FormEvent } from 'react'
import type { ManualActivityType, RecordKind, UUID } from '@/api'
import { ApiError } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useAddActivity } from '@/queries/records'
import { ACTIVITY_LABEL, MANUAL_ACTIVITY_TYPES, nowLocalInput } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'

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
      title="Registrar atendimento"
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
        <Field label="Tipo" htmlFor="act-type" required>
          <Select id="act-type" value={actionType} onChange={(e) => setActionType(e.target.value as ManualActivityType)}>
            {MANUAL_ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
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
