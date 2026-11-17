import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { EyeOff, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { ApiError, type CategoryActivityType } from '@/api'
import { useCategory, useActivityTypes, useDeleteActivityType, useSaveActivityType } from '@/queries/admin'
import { typeIcon, typeStyles } from '@/lib/activityTypes'
import { PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { ActivityTypeFormModal } from '@/components/admin/ActivityTypeFormModal'
import { TypeChip } from '@/components/records/Timeline'

/** Tipos de registro manual da linha do tempo de uma categoria (nativa ou dinâmica). */
export function TiposRegistroPage() {
  const { categoryId } = useParams()
  const category = useCategory(categoryId)
  const types = useActivityTypes(categoryId, { includeInactive: true })
  const del = useDeleteActivityType(categoryId!)
  const save = useSaveActivityType(categoryId!)
  const confirm = useConfirm()
  const toast = useToast()
  const [modal, setModal] = useState<{ open: boolean; type?: CategoryActivityType | null }>({ open: false })

  if (category.isPending) return <LoadingBlock />
  if (category.isError) return <ErrorState error={category.error} />

  const list = types.data ?? []
  const nextPosition = list.length ? Math.max(...list.map((t) => t.position)) + 1 : 0

  const deactivate = (t: CategoryActivityType) =>
    save.mutateAsync({
      id: t.id,
      body: { key: t.key, label: t.label, description: t.description, color: t.color, position: t.position, isActive: false },
    })

  const onDelete = async (t: CategoryActivityType) => {
    const ok = await confirm({
      title: 'Excluir tipo de registro',
      message: (
        <>
          O tipo <strong>{t.label}</strong> será excluído. Só é possível excluir tipos que nunca foram usados.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(t.id)
      toast.success('Tipo de registro excluído.')
    } catch (err) {
      if (!(err instanceof ApiError && err.isConflict)) return toast.error(err)
      const off = await confirm({
        title: 'Tipo já usado na linha do tempo',
        message: (
          <>
            <strong>{t.label}</strong> já aparece em registros e não pode ser excluído. Deseja desativá-lo? Ele deixa de
            aparecer para novos registros, e o histórico continua igual.
          </>
        ),
        confirmLabel: 'Desativar',
      })
      if (!off) return
      try {
        await deactivate(t)
        toast.success('Tipo de registro desativado.')
      } catch (e) {
        toast.error(e)
      }
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Categorias e campos', to: '/admin/categorias' }, { label: category.data.name }]}
        title={`Tipos de registro · ${category.data.name}`}
        description="Opções que a equipe escolhe ao registrar algo na linha do tempo desta categoria."
        actions={
          <>
            {category.data.entityType === 'dynamic' && (
              <ButtonLink
                to={`/admin/categorias/${categoryId}/campos`}
                variant="secondary"
                icon={<ListChecks className="size-4" />}
              >
                Campos
              </ButtonLink>
            )}
            <Button icon={<Plus className="size-4" />} onClick={() => setModal({ open: true })}>
              Novo tipo
            </Button>
          </>
        }
      />

      <div className="card">
        {types.isPending ? (
          <LoadingBlock />
        ) : types.isError ? (
          <ErrorState error={types.error} onRetry={() => types.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title="Nenhum tipo de registro"
            description="Sem tipos, ninguém consegue registrar atendimentos nesta categoria."
            action={
              <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setModal({ open: true })}>
                Criar o primeiro
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {list.map((t) => {
              const Icon = typeIcon(t.key)
              return (
                <li key={t.id} className={`flex items-center gap-4 px-5 py-3.5 ${t.isActive ? '' : 'opacity-60'}`}>
                  <span className="w-6 text-right text-xs text-ink-400 tabular-nums">{t.position}</span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full" style={typeStyles(t).icon}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeChip type={t} />
                      <code className="text-xs text-ink-500">{t.key}</code>
                      {!t.isActive && (
                        <Badge icon={<EyeOff className="size-3" />}>Inativo</Badge>
                      )}
                    </div>
                    {t.description && <p className="mt-1 truncate text-xs text-ink-500">{t.description}</p>}
                  </div>
                  <div className="flex shrink-0">
                    <IconButton label="Editar" onClick={() => setModal({ open: true, type: t })}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton label="Excluir" variant="danger-ghost" onClick={() => onDelete(t)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ActivityTypeFormModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        categoryId={categoryId!}
        type={modal.type}
        nextPosition={nextPosition}
      />
    </>
  )
}
