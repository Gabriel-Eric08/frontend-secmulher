import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import type { DynamicEntity } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useCategory, useFields } from '@/queries/admin'
import { useDeleteEntity, useOverview } from '@/queries/records'
import { formatDateTime, formatValue } from '@/lib/format'
import { DescriptionList, PageHeader } from '@/components/ui/Layout'
import { HiddenValue } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { DynamicValue } from '@/components/dynamic/DynamicField'
import { RecordWorkspace } from '@/components/records/RecordWorkspace'

export function CadastroDetailPage() {
  const { categoryId, id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { accessFor } = useAuth()
  const access = accessFor(categoryId!)
  const category = useCategory(categoryId)
  const fields = useFields(categoryId, access.canRead)
  const overview = useOverview<DynamicEntity>('dynamic-entities', id)
  const del = useDeleteEntity()

  if (!access.canRead) return <ForbiddenState />
  if (overview.isPending || fields.isPending) return <LoadingBlock />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />

  const { record: e, activities, files } = overview.data
  const allFields = fields.data ?? []
  const hidden = new Set(e.hiddenFields ?? [])
  const firstReadable = allFields.find((f) => !hidden.has(f.key) && f.fieldType === 'TEXT')
  const title = firstReadable ? formatValue(e.customFields[firstReadable.key]) : `Registro ${e.id.slice(0, 8)}`
  const base = `/cadastros/${categoryId}`
  const labelFor = (key: string) => allFields.find((f) => f.key === key)?.label ?? key

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir registro',
      message: 'O registro e seus documentos serão excluídos. O histórico permanece para auditoria.',
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(e.id)
      toast.success('Registro excluído.')
      navigate(base, { replace: true })
    } catch (err) {
      toast.error(err)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: category.data?.name ?? 'Cadastro', to: base }, { label: title }]}
        title={title}
        actions={
          <>
            {access.canUpdate && (
              <ButtonLink to={`${base}/${e.id}/editar`} variant="secondary" icon={<Pencil className="size-4" />}>
                Editar
              </ButtonLink>
            )}
            {access.canDelete && (
              <Button variant="danger-ghost" icon={<Trash2 className="size-4" />} onClick={onDelete} loading={del.isPending}>
                Excluir
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="lg:col-span-1">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Dados</h2>
            <DescriptionList
              items={[
                ...allFields.map((f) => ({
                  label: f.label,
                  value: hidden.has(f.key) || !access.canReadColumn(f.key) ? <HiddenValue /> : <DynamicValue field={f} value={e.customFields[f.key]} />,
                })),
                { label: 'Criado em', value: formatDateTime(e.createdAt) },
                { label: 'Última alteração', value: formatDateTime(e.updatedAt) },
              ]}
            />
          </section>
        </aside>
        <div className="lg:col-span-2">
          <RecordWorkspace
            kind="dynamic-entities"
            recordId={e.id}
            activities={activities}
            files={files}
            access={access}
            labelFor={labelFor}
          />
        </div>
      </div>
    </>
  )
}
