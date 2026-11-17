import { useEffect, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { ApiError, type ActivityTypeRequest, type CategoryActivityType, type UUID } from '@/api'
import { useSaveActivityType } from '@/queries/admin'
import { DEFAULT_TYPE_COLOR, TYPE_COLOR_PRESETS, typeIcon, typeStyles } from '@/lib/activityTypes'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Form'
import { Alert } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'

const KEY_RE = /^[a-z][a-z0-9_]*$/
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

const toKey = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+|_+$/g, '')

export function ActivityTypeFormModal({
  open,
  onClose,
  categoryId,
  type,
  nextPosition,
}: {
  open: boolean
  onClose: () => void
  categoryId: UUID
  type?: CategoryActivityType | null
  nextPosition: number
}) {
  const toast = useToast()
  const save = useSaveActivityType(categoryId)
  const isEdit = !!type
  const [form, setForm] = useState<ActivityTypeRequest>({
    key: '',
    label: '',
    description: '',
    color: DEFAULT_TYPE_COLOR,
    position: nextPosition,
    isActive: true,
  })
  const [keyTouched, setKeyTouched] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [conflict, setConflict] = useState('')

  useEffect(() => {
    if (!open) return
    setErrors({})
    setConflict('')
    setKeyTouched(isEdit)
    setForm(
      type
        ? {
            key: type.key,
            label: type.label,
            description: type.description ?? '',
            color: type.color ?? DEFAULT_TYPE_COLOR,
            position: type.position,
            isActive: type.isActive,
          }
        : { key: '', label: '', description: '', color: DEFAULT_TYPE_COLOR, position: nextPosition, isActive: true },
    )
  }, [open, type, nextPosition, isEdit])

  const color = form.color || DEFAULT_TYPE_COLOR
  const Icon = typeIcon(form.key)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.label.trim()) errs.label = 'Informe o nome.'
    if (!KEY_RE.test(form.key)) errs.key = 'Use letras minúsculas, números e "_", começando por letra.'
    if (form.color && !HEX_RE.test(form.color)) errs.color = 'Use uma cor hexadecimal, ex.: #5b2a86.'
    setErrors(errs)
    setConflict('')
    if (Object.keys(errs).length) return
    try {
      await save.mutateAsync({
        id: type?.id,
        body: { ...form, label: form.label.trim(), description: form.description?.trim() || null },
      })
      toast.success(isEdit ? 'Tipo de registro atualizado.' : 'Tipo de registro criado.')
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) setConflict(err.detail)
      else if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar tipo de registro' : 'Novo tipo de registro'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="atype-form" loading={save.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="atype-form" onSubmit={submit} className="space-y-4">
        {conflict && <Alert tone="danger">{conflict}</Alert>}

        {/* prévia de como aparece na linha do tempo */}
        <div className="flex items-center gap-3 rounded-lg border border-l-4 border-ink-200 bg-ink-50/60 px-3 py-2.5" style={typeStyles({ color }).accent}>
          <span className="flex size-8 items-center justify-center rounded-full" style={typeStyles({ color }).icon}>
            <Icon className="size-4" />
          </span>
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={typeStyles({ color }).chip}>
            {form.label || 'Nome do tipo'}
          </span>
          <span className="text-xs text-ink-400">prévia</span>
        </div>

        <Field label="Nome" htmlFor="at-label" required error={errors.label} hint="Como aparece na linha do tempo.">
          <Input
            id="at-label"
            value={form.label}
            invalid={!!errors.label}
            placeholder="Ex.: Atendimento psicológico"
            onChange={(e) => {
              const label = e.target.value
              setForm((f) => ({ ...f, label, key: keyTouched ? f.key : toKey(label) }))
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field
            label="Chave"
            htmlFor="at-key"
            required
            error={errors.key}
            hint={isEdit ? 'A chave não pode ser alterada.' : 'Usada na API e nas permissões.'}
          >
            <Input
              id="at-key"
              value={form.key}
              disabled={isEdit}
              invalid={!!errors.key}
              className="font-mono"
              onChange={(e) => {
                setKeyTouched(true)
                setForm((f) => ({ ...f, key: e.target.value }))
              }}
            />
          </Field>
          <Field label="Posição" htmlFor="at-pos">
            <Input
              id="at-pos"
              type="number"
              min={0}
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: Number(e.target.value) }))}
            />
          </Field>
        </div>
        <Field label="Descrição" htmlFor="at-desc" hint="Opcional: ajuda a equipe a escolher o tipo certo.">
          <Textarea
            id="at-desc"
            rows={2}
            className="min-h-0"
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </Field>
        <Field label="Cor" error={errors.color}>
          <div className="flex flex-wrap items-center gap-2">
            {TYPE_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Cor ${c}`}
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={clsx(
                  'flex size-7 items-center justify-center rounded-full ring-offset-2 transition',
                  color.toLowerCase() === c && 'ring-2 ring-ink-400',
                )}
                style={{ backgroundColor: c }}
              >
                {color.toLowerCase() === c && <Check className="size-3.5 text-white" />}
              </button>
            ))}
            <label className="ml-1 flex items-center gap-1.5 text-xs text-ink-500">
              <input
                type="color"
                value={HEX_RE.test(color) && color.length === 7 ? color : DEFAULT_TYPE_COLOR}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="size-7 cursor-pointer rounded border border-ink-300 bg-white p-0.5"
              />
              outra
            </label>
          </div>
        </Field>
        <Checkbox
          label="Ativo"
          description="Tipos inativos deixam de aparecer para novos registros; o histórico continua."
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />
      </form>
    </Modal>
  )
}
