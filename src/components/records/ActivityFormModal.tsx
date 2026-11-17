import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { RecordKind, UUID } from '@/api'
import { ApiError } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useRegistrableTypes } from '@/auth/useRegistrableTypes'
import { useAddActivity } from '@/queries/records'
import { nowLocalInput } from '@/lib/format'
import { typeIcon, typeStyles } from '@/lib/activityTypes'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { Alert } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

export function ActivityFormModal({
  open,
  onClose,
  kind,
  recordId,
  categoryId,
}: {
  open: boolean
  onClose: () => void
  kind: RecordKind
  recordId: UUID
  /** Categoria do registro: define quais tipos de registro estão disponíveis */
  categoryId: UUID | undefined
}) {
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const add = useAddActivity(kind, recordId)
  const { types, isLoading, error } = useRegistrableTypes(open ? categoryId : undefined)
  const [typeId, setTypeId] = useState<UUID>('')
  const [description, setDescription] = useState('')
  const [responsible, setResponsible] = useState(user?.name ?? '')
  const [occurredAt, setOccurredAt] = useState(nowLocalInput())
  const [errors, setErrors] = useState<Record<string, string>>({})

  // pré-seleciona o primeiro tipo disponível
  useEffect(() => {
    if (open && types.length && !types.some((t) => t.id === typeId)) setTypeId(types[0].id)
  }, [open, types, typeId])

  const reset = () => {
    setTypeId('')
    setDescription('')
    setResponsible(user?.name ?? '')
    setOccurredAt(nowLocalInput())
    setErrors({})
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!typeId) errs.activityTypeId = 'Escolha o tipo de registro.'
    if (!description.trim()) errs.description = 'Descreva o registro.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await add.mutateAsync({
        activityTypeId: typeId,
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

  const noTypes = !isLoading && !error && types.length === 0

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
          <Button type="submit" form="activity-form" loading={add.isPending} disabled={noTypes || isLoading}>
            Registrar
          </Button>
        </>
      }
    >
      {isLoading ? (
        <LoadingBlock label="Carregando tipos de registro…" />
      ) : error ? (
        <Alert tone="danger">Não foi possível carregar os tipos de registro desta categoria.</Alert>
      ) : noTypes ? (
        <Alert tone="warning" title="Nenhum tipo de registro disponível">
          {isAdmin && categoryId ? (
            <>
              Cadastre os tipos em{' '}
              <Link to={`/admin/categorias/${categoryId}/tipos`} className="font-medium underline" onClick={onClose}>
                Tipos de registro
              </Link>
              .
            </>
          ) : (
            'Seu perfil não tem tipos de registro liberados nesta categoria. Procure a coordenação.'
          )}
        </Alert>
      ) : (
        <form id="activity-form" onSubmit={submit} className="space-y-4">
          <fieldset>
            <legend className="label">
              Tipo de registro <span className="text-red-600">*</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {types.map((t) => {
                const Icon = typeIcon(t.key)
                const active = typeId === t.id
                const styles = typeStyles(t)
                return (
                  <label
                    key={t.id}
                    style={active ? styles.ring : undefined}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-200 p-3 transition-colors hover:border-ink-300"
                  >
                    <input
                      type="radio"
                      name="act-type"
                      value={t.id}
                      checked={active}
                      onChange={() => setTypeId(t.id)}
                      className="sr-only"
                    />
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full" style={styles.icon}>
                      <Icon className="size-3.5" />
                    </span>
                    <span className="text-sm font-medium text-ink-900">{t.label}</span>
                  </label>
                )
              })}
            </div>
            {errors.activityTypeId && <p className="mt-1 text-xs text-red-600">{errors.activityTypeId}</p>}
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
      )}
    </Modal>
  )
}
