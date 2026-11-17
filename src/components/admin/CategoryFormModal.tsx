import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, type Category, type CategoryRequest } from '@/api'
import { MULHERES_TABLE } from '@/auth/access'
import { useSaveCategory } from '@/queries/admin'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

export const MULHERES_CATEGORY_PRESET: CategoryRequest = {
  name: 'Mulheres atendidas',
  entityType: 'native',
  tableReference: MULHERES_TABLE,
  isActive: true,
}

export function CategoryFormModal({
  open,
  onClose,
  category,
  preset,
}: {
  open: boolean
  onClose: () => void
  category?: Category | null
  preset?: CategoryRequest
}) {
  const toast = useToast()
  const save = useSaveCategory()
  const isEdit = !!category
  const [form, setForm] = useState<CategoryRequest>({ name: '', entityType: 'dynamic', tableReference: '', isActive: true })
  const [refTouched, setRefTouched] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setRefTouched(isEdit || !!preset)
    setForm(
      category
        ? { name: category.name, entityType: category.entityType, tableReference: category.tableReference, isActive: category.isActive }
        : (preset ?? { name: '', entityType: 'dynamic', tableReference: '', isActive: true }),
    )
  }, [open, category, preset, isEdit])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Informe o nome.'
    if (!form.tableReference.trim()) errs.tableReference = 'Informe a referência.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await save.mutateAsync({ id: category?.id, body: { ...form, name: form.name.trim() } })
      toast.success(isEdit ? 'Categoria atualizada.' : 'Categoria criada.')
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
      title={isEdit ? 'Editar categoria' : 'Nova categoria'}
      description="Categorias são tipos de cadastro: abrigos, cursos, municípios parceiros…"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="cat-form" loading={save.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="cat-form" onSubmit={submit} className="space-y-4">
        <Field label="Nome" htmlFor="c-name" required error={errors.name}>
          <Input
            id="c-name"
            value={form.name}
            invalid={!!errors.name}
            onChange={(e) => {
              const name = e.target.value
              setForm((f) => ({ ...f, name, tableReference: refTouched ? f.tableReference : slugify(name) }))
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Tipo"
            htmlFor="c-type"
            hint={form.entityType === 'dynamic' ? 'Campos definidos pela administração.' : 'Tabela própria do sistema.'}
          >
            <Select
              id="c-type"
              value={form.entityType}
              disabled={isEdit}
              onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value as CategoryRequest['entityType'] }))}
            >
              <option value="dynamic">Dinâmica</option>
              <option value="native">Nativa</option>
            </Select>
          </Field>
          <Field
            label="Referência"
            htmlFor="c-ref"
            required
            error={errors.tableReference}
            hint={form.entityType === 'native' ? `Mulheres atendidas: "${MULHERES_TABLE}"` : 'Identificador interno.'}
          >
            <Input
              id="c-ref"
              value={form.tableReference}
              invalid={!!errors.tableReference}
              onChange={(e) => {
                setRefTouched(true)
                setForm((f) => ({ ...f, tableReference: e.target.value }))
              }}
            />
          </Field>
        </div>
        <Checkbox
          label="Ativa"
          description="Categorias inativas não recebem novos registros."
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />
      </form>
    </Modal>
  )
}
