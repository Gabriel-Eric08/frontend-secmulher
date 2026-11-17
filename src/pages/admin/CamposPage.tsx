import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ExternalLink, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { ApiError, type CategoryField } from '@/api'
import { useCategory, useDeleteField, useFields } from '@/queries/admin'
import { FIELD_TYPE_LABEL } from '@/lib/format'
import { PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { Alert, EmptyState, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { FieldFormModal } from '@/components/admin/FieldFormModal'

export function CamposPage() {
  const { categoryId } = useParams()
  const category = useCategory(categoryId)
  const fields = useFields(categoryId)
  const del = useDeleteField(categoryId!)
  const confirm = useConfirm()
  const toast = useToast()
  const [modal, setModal] = useState<{ open: boolean; field?: CategoryField | null }>({ open: false })

  if (category.isPending) return <LoadingBlock />
  if (category.isError) return <ErrorState error={category.error} />
  if (category.data.entityType !== 'dynamic')
    return <Alert tone="warning">Somente categorias dinâmicas têm campos personalizados.</Alert>

  const list = fields.data ?? []
  const nextPosition = list.length ? Math.max(...list.map((f) => f.position)) + 1 : 1

  const onDelete = async (f: CategoryField) => {
    const ok = await confirm({
      title: 'Excluir campo',
      message: <>O campo <strong>{f.label}</strong> será removido do formulário.</>,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync({ id: f.id })
      toast.success('Campo excluído.')
    } catch (err) {
      if (!(err instanceof ApiError && err.isConflict)) return toast.error(err)
      const purge = await confirm({
        title: 'O campo possui dados',
        message: (
          <>
            Existem registros com valores em <strong>{f.label}</strong>. Excluir mesmo assim apagará esse valor de{' '}
            <strong>todos os registros</strong>. Esta ação não pode ser desfeita.
          </>
        ),
        confirmLabel: 'Excluir e apagar dados',
        danger: true,
      })
      if (!purge) return
      try {
        await del.mutateAsync({ id: f.id, purgeData: true })
        toast.success('Campo e dados excluídos.')
      } catch (e) {
        toast.error(e)
      }
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Categorias e campos', to: '/admin/categorias' }, { label: category.data.name }]}
        title={`Campos · ${category.data.name}`}
        description="Os campos definem o formulário, as colunas da listagem e os filtros disponíveis."
        actions={
          <>
            <ButtonLink to={`/cadastros/${categoryId}`} variant="secondary" icon={<ExternalLink className="size-4" />}>
              Ver registros
            </ButtonLink>
            <ButtonLink to={`/admin/categorias/${categoryId}/tipos`} variant="secondary" icon={<Tags className="size-4" />}>
              Tipos de registro
            </ButtonLink>
            <Button icon={<Plus className="size-4" />} onClick={() => setModal({ open: true })}>
              Novo campo
            </Button>
          </>
        }
      />

      <div className="card">
        {fields.isPending ? (
          <LoadingBlock />
        ) : fields.isError ? (
          <ErrorState error={fields.error} />
        ) : list.length === 0 ? (
          <EmptyState title="Nenhum campo" description="Adicione o primeiro campo do formulário." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Rótulo</th>
                  <th>Chave</th>
                  <th>Tipo</th>
                  <th>Opções</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((f) => (
                  <tr key={f.id}>
                    <td className="text-ink-400 tabular-nums">{f.position}</td>
                    <td className="font-medium text-ink-900">
                      {f.label}
                      {f.isRequired && <span className="ml-1 text-red-600">*</span>}
                    </td>
                    <td>
                      <code className="text-xs text-ink-600">{f.key}</code>
                    </td>
                    <td>
                      <Badge tone="brand">{FIELD_TYPE_LABEL[f.fieldType]}</Badge>
                    </td>
                    <td className="max-w-xs truncate text-xs text-ink-600" title={f.options?.join(', ')}>
                      {f.options?.join(', ') || '—'}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <IconButton label="Editar" onClick={() => setModal({ open: true, field: f })}>
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton label="Excluir" variant="danger-ghost" onClick={() => onDelete(f)}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FieldFormModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        categoryId={categoryId!}
        field={modal.field}
        nextPosition={nextPosition}
      />
    </>
  )
}
