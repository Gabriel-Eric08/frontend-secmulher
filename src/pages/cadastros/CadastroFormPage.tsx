import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, type CustomFields, type CustomFieldValue } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useCategory, useFields } from '@/queries/admin'
import { useEntity, useSaveEntity } from '@/queries/records'
import { Card, PageHeader } from '@/components/ui/Layout'
import { Button } from '@/components/ui/Button'
import { Alert, EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { PageSkeleton } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { DynamicFieldInput } from '@/components/dynamic/DynamicField'

const isEmpty = (v: unknown) => v === null || v === undefined || v === ''

export function CadastroFormPage() {
  const { categoryId, id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const toast = useToast()
  const { accessFor } = useAuth()
  const access = accessFor(categoryId!)
  const category = useCategory(categoryId)
  const fields = useFields(categoryId, access.canRead)
  const existing = useEntity(id)
  const save = useSaveEntity()
  const [values, setValues] = useState<CustomFields>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (existing.data) setValues(existing.data.customFields)
  }, [existing.data])

  if (isEdit ? !access.canUpdate : !access.canCreate) return <ForbiddenState />
  if (fields.isPending || category.isPending || (isEdit && existing.isPending)) return <PageSkeleton />
  const error = fields.error ?? category.error ?? existing.error
  if (error) return <ErrorState error={error} />

  const hidden = new Set(existing.data?.hiddenFields ?? [])
  const visibleFields = fields.data!.filter(
    (f) => !hidden.has(f.key) && access.canReadColumn(f.key) && (isEdit || access.canWriteColumn(f.key)),
  )
  const base = `/cadastros/${categoryId}`
  const title = isEdit ? 'Editar registro' : 'Novo registro'

  const set = (key: string, v: CustomFieldValue) => {
    setValues((s) => ({ ...s, [key]: v }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    for (const f of visibleFields) {
      if (f.isRequired && access.canWriteColumn(f.key) && isEmpty(values[f.key])) e[f.key] = 'Campo obrigatório.'
    }
    setErrors(e)
    if (Object.keys(e).length) return

    // Envia só os campos visíveis e preenchidos; campos ocultos são preservados pelo backend.
    const customFields: CustomFields = {}
    for (const f of visibleFields) {
      const v = values[f.key]
      if (!isEmpty(v)) customFields[f.key] = v
    }
    try {
      const saved = await save.mutateAsync({ id, body: { categoryId: categoryId!, customFields } })
      toast.success(isEdit ? 'Registro atualizado.' : 'Registro criado.')
      navigate(`${base}/${saved.id}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        // erros de campos dinâmicos podem vir como "customFields.chave" ou só "chave"
        const mapped: Record<string, string> = {}
        for (const [k, msg] of Object.entries(err.fieldErrors)) mapped[k.replace(/^customFields\.?/, '')] = msg
        setErrors(mapped)
        toast.error(err.detail)
      } else toast.error(err)
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: category.data?.name ?? 'Cadastro', to: base },
          ...(isEdit ? [{ label: 'Registro', to: `${base}/${id}` }] : []),
          { label: title },
        ]}
      />

      <form onSubmit={submit} className="max-w-2xl space-y-6">
        {visibleFields.length < fields.data!.length && (
          <Alert>Alguns campos não aparecem porque seu perfil não tem permissão sobre eles.</Alert>
        )}
        <Card title={category.data?.name}>
          {visibleFields.length === 0 ? (
            <EmptyState title="Nenhum campo disponível" description="Esta categoria não tem campos que você possa preencher." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {visibleFields.map((f) => (
                <div key={f.id} className={f.fieldType === 'TEXT' ? 'sm:col-span-2' : ''}>
                  <DynamicFieldInput
                    field={f}
                    value={values[f.key]}
                    onChange={(v) => set(f.key, v)}
                    error={errors[f.key]}
                    disabled={!access.canWriteColumn(f.key)}
                    locked={!access.canWriteColumn(f.key)}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending} disabled={visibleFields.length === 0}>
            {isEdit ? 'Salvar alterações' : 'Criar registro'}
          </Button>
        </div>
      </form>
    </>
  )
}
