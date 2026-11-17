import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Permission } from '@/api'
import { MULHERES_TABLE } from '@/auth/access'
import { useCategories, useDeletePermission, usePermissions, useUsers } from '@/queries/admin'
import { columnLabel } from '@/lib/format'
import { Avatar, PageHeader } from '@/components/ui/Layout'
import { ConfidentialityBadge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Select } from '@/components/ui/Form'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { PermissionModal } from '@/components/admin/PermissionModal'
import { ActionFlags, ColumnsSummary } from '@/components/admin/PermissionSummary'

/** Visão geral da matriz funcionária × categoria. */
export function PermissoesPage() {
  const perms = usePermissions()
  const users = useUsers()
  const categories = useCategories()
  const del = useDeletePermission()
  const confirm = useConfirm()
  const toast = useToast()
  const [userFilter, setUserFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [modal, setModal] = useState<{ open: boolean; permission?: Permission | null }>({ open: false })

  const userById = useMemo(() => new Map((users.data ?? []).map((u) => [u.id, u])), [users.data])
  const catById = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c])), [categories.data])

  const rows = (perms.data ?? [])
    .filter((p) => (!userFilter || p.userId === userFilter) && (!catFilter || p.categoryId === catFilter))
    .sort((a, b) => (userById.get(a.userId)?.name ?? '').localeCompare(userById.get(b.userId)?.name ?? '', 'pt-BR'))

  const onRemove = async (p: Permission) => {
    const ok = await confirm({
      title: 'Remover permissão',
      message: `${userById.get(p.userId)?.name ?? 'A funcionária'} perderá o acesso a "${catById.get(p.categoryId)?.name ?? ''}".`,
      confirmLabel: 'Remover',
      danger: true,
    })
    if (!ok) return
    del.mutate(p.id, { onSuccess: () => toast.success('Permissão removida.'), onError: (e) => toast.error(e) })
  }

  return (
    <>
      <PageHeader
        title="Permissões"
        description="Quem acessa o quê: ações, colunas visíveis e nível de sigilo por categoria."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setModal({ open: true })}>
            Nova permissão
          </Button>
        }
      />
      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row">
          <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="sm:w-64">
            <option value="">Todas as funcionárias</option>
            {(users.data ?? [])
              .filter((u) => !u.isGlobalAdmin)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </Select>
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="sm:w-64">
            <option value="">Todas as categorias</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        {perms.isPending ? (
          <LoadingBlock />
        ) : perms.isError ? (
          <ErrorState error={perms.error} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhuma permissão" description="Administradoras têm acesso total e não precisam de permissões." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Funcionária</th>
                  <th>Categoria</th>
                  <th>Ações</th>
                  <th>Colunas</th>
                  <th>Sigilo máx.</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const u = userById.get(p.userId)
                  const c = catById.get(p.categoryId)
                  const isMulheres = c?.entityType === 'native' && c.tableReference === MULHERES_TABLE
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/admin/funcionarias/${p.userId}`} className="flex items-center gap-2 font-medium text-ink-900 hover:text-brand-700">
                          <Avatar name={u?.name} size="sm" />
                          {u?.name ?? '—'}
                        </Link>
                      </td>
                      <td className="text-ink-700">{c?.name ?? '—'}</td>
                      <td>
                        <ActionFlags p={p} />
                      </td>
                      <td>
                        <ColumnsSummary cols={p.allowedColumns} labelFor={isMulheres ? columnLabel : undefined} />
                      </td>
                      <td>
                        <ConfidentialityBadge level={p.maxConfidentiality} />
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <IconButton label="Editar" onClick={() => setModal({ open: true, permission: p })}>
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton label="Remover" variant="danger-ghost" onClick={() => onRemove(p)}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <PermissionModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        permission={modal.permission}
        users={users.data ?? []}
        categories={categories.data ?? []}
        existing={perms.data ?? []}
      />
    </>
  )
}
