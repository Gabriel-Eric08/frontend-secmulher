import { useEffect, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { ApiError, type CategoryField, type CategoryFieldRequest, type FieldType, type UUID } from '@/api'
import { useSaveField } from '@/queries/admin'
import { FIELD_TYPE_LABEL } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select } from '@/components/ui/Form'
import { Alert } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'

const KEY_RE = /^[a-z][a-z0-9_]*$/

const toKey = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+|_+$/g, '')

export function FieldFormModal({
  open,
  onClose,
  categoryId,
  field,
  nextPosition,
}: {
  open: boolean
  onClose: () => void
  categoryId: UUID
  field?: CategoryField | null
  nextPosition: number
}) {
  const toast = useToast()
  const save = useSaveField(categoryId)
  const isEdit = !!field
  const [form, setForm] = useState<CategoryFieldRequest>({
    key: '',
    label: '',
    fieldType: 'TEXT',
    isRequired: false,
    options: [],
    position: nextPosition,
  })
  const [keyTouched, setKeyTouched] = useState(false)
  const [newOption, setNewOption] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [conflict, setConflict] = useState('')

  useEffect(() => {
    if (!open) return
    setErrors({})
    setConflict('')
    setNewOption('')
    setKeyTouched(isEdit)
    setForm(
      field
        ? {
            key: field.key,
            label: field.label,
            fieldType: field.fieldType,
            isRequired: field.isRequired,
            options: field.options ?? [],
            position: field.position,
          }
        : { key: '', label: '', fieldType: 'TEXT', isRequired: false, options: [], position: nextPosition },
    )
  }, [open, field, nextPosition, isEdit])

  const options = form.options ?? []

  const addOption = () => {
    const v = newOption.trim()
    if (!v || options.includes(v)) return
    setForm((f) => ({ ...f, options: [...options, v] }))
    setNewOption('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.label.trim()) errs.label = 'Informe o rótulo.'
    if (!KEY_RE.test(form.key)) errs.key = 'Use letras minúsculas, números e "_", começando por letra.'
    if (form.fieldType === 'LIST' && options.length === 0) errs.options = 'Adicione ao menos uma opção.'
    setErrors(errs)
    setConflict('')
    if (Object.keys(errs).length) return
    const body: CategoryFieldRequest = {
      ...form,
      label: form.label.trim(),
      options: form.fieldType === 'LIST' ? options : null,
    }
    try {
      await save.mutateAsync({ id: field?.id, body })
      toast.success(isEdit ? 'Campo atualizado.' : 'Campo criado.')
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
      title={isEdit ? 'Editar campo' : 'Novo campo'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="field-form" loading={save.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="field-form" onSubmit={submit} className="space-y-4">
        {conflict && <Alert tone="danger">{conflict}</Alert>}
        <Field label="Rótulo" htmlFor="fd-label" required error={errors.label} hint="Como o campo aparece no formulário.">
          <Input
            id="fd-label"
            value={form.label}
            invalid={!!errors.label}
            onChange={(e) => {
              const label = e.target.value
              setForm((f) => ({ ...f, label, key: keyTouched ? f.key : toKey(label) }))
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Chave"
            htmlFor="fd-key"
            required
            error={errors.key}
            hint={isEdit ? 'A chave não pode ser alterada.' : 'Usada na API e nas permissões.'}
          >
            <Input
              id="fd-key"
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
          <Field label="Tipo" htmlFor="fd-type" hint={isEdit ? 'Só pode mudar se o campo não tiver dados.' : undefined}>
            <Select
              id="fd-type"
              value={form.fieldType}
              onChange={(e) => setForm((f) => ({ ...f, fieldType: e.target.value as FieldType }))}
            >
              {(Object.keys(FIELD_TYPE_LABEL) as FieldType[]).map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {form.fieldType === 'LIST' && (
          <Field label="Opções" required error={errors.options} hint="Opções em uso por registros não podem ser removidas.">
            <div className="space-y-2">
              {options.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {options.map((o) => (
                    <li key={o} className="flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pr-1 pl-2.5 text-xs text-brand-800">
                      {o}
                      <IconButton
                        label={`Remover ${o}`}
                        className="size-5"
                        onClick={() => setForm((f) => ({ ...f, options: options.filter((x) => x !== o) }))}
                      >
                        <X className="size-3" />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  value={newOption}
                  placeholder="Nova opção"
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addOption()
                    }
                  }}
                />
                <Button variant="secondary" icon={<Plus className="size-4" />} onClick={addOption}>
                  Adicionar
                </Button>
              </div>
            </div>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Posição" htmlFor="fd-pos" hint="Ordem de exibição.">
            <Input
              id="fd-pos"
              type="number"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: Number(e.target.value) }))}
            />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label="Obrigatório"
              checked={form.isRequired}
              onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}
