import { useState } from 'react'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { ApiError, type AmendmentSector } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useAmendmentSectors, useDeleteAmendmentSector } from '@/queries/amendments'
import { PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { SectorFormModal } from '@/components/amendments/AmendmentModals'

export function SetoresPage() {
  const { amendmentsAccess: access } = useAuth()
  const sectors = useAmendmentSectors(access.canRead)
  const del = useDeleteAmendmentSector()
  const confirm = useConfirm()
  const toast = useToast()
  const [modal, setModal] = useState<{ open: boolean; sector?: AmendmentSector | null }>({ open: false })

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de emendas." />

  const list = [...(sectors.data ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'pt-BR'))

  const onDelete = async (s: AmendmentSector) => {
    const ok = await confirm({
      title: 'Excluir setor',
      message: (
        <>
          O setor <strong>{s.name}</strong> será excluído. Setores com emendas não podem ser excluídos: desative-os.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(s.id)
      toast.success('Setor excluído.')
    } catch (err) {
      toast.error(err instanceof ApiError && err.isConflict ? 'O setor tem emendas. Desative-o em vez de excluir.' : err)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Emendas', to: '/emendas' }, { label: 'Setores' }]}
        title="Setores responsáveis"
        description="Setores que acompanham as emendas. Setor inativo não recebe novas emendas."
        actions={
          access.canCreate && (
            <Button icon={<Plus className="size-4" />} onClick={() => setModal({ open: true })}>
              Novo setor
            </Button>
          )
        }
      />

      <div className="card overflow-hidden">
        {sectors.isPending ? (
          <LoadingBlock />
        ) : sectors.isError ? (
          <ErrorState error={sectors.error} onRetry={() => sectors.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="Nenhum setor cadastrado"
            action={
              access.canCreate && (
                <Button icon={<Plus className="size-4" />} onClick={() => setModal({ open: true })}>
                  Novo setor
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {list.map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Building2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-ink-900">
                    {s.name}
                    {!s.isActive && <Badge>Inativo</Badge>}
                  </p>
                  {s.description && <p className="truncate text-sm text-ink-500">{s.description}</p>}
                </div>
                {access.canUpdate && (
                  <IconButton label="Editar" onClick={() => setModal({ open: true, sector: s })}>
                    <Pencil className="size-4" />
                  </IconButton>
                )}
                {access.canDelete && (
                  <IconButton label="Excluir" variant="danger-ghost" onClick={() => onDelete(s)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <SectorFormModal open={modal.open} sector={modal.sector} onClose={() => setModal({ open: false })} />
    </>
  )
}
