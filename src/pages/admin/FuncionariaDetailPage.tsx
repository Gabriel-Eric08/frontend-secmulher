import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import type { Permission } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { MULHERES_TABLE } from '@/auth/access'
import {
  useCategories,
  useDeletePermission,
  useDeleteUser,
  usePermissions,
  useUser,
  useUserActivities,
} from '@/queries/admin'
import { ACTIVITY_LABEL, columnLabel, formatDateTime } from '@/lib/format'
import { Avatar, Card, PageHeader, Tabs } from '@/components/ui/Layout'
import { Badge, ConfidentialityBadge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Alert, EmptyState, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { UserFormModal } from '@/components/admin/UserFormModal'
import { PermissionModal } from '@/components/admin/PermissionModal'
import { ActionFlags, ColumnsSummary } from '@/components/admin/PermissionSummary'

export function FuncionariaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { user: me } = useAuth()
  const user = useUser(id)
  const perms = usePermissions(id)
  const categories = useCategories()
  const activities = useUserActivities(id)
  const delUser = useDeleteUser()
  const delPerm = useDeletePermission()
  const [tab, setTab] = useState<'perms' | 'audit'>('perms')
  const [editing, setEditing] = useState(false)
  const [permModal, setPermModal] = useState<{ open: boolean; permission?: Permission | null }>({ open: false })

  if (user.isPending) return <LoadingBlock />
  if (user.isError) return <ErrorState error={user.error} />

  const u = user.data
  const isSelf = u.id === me?.id
  const catName = (cid: string) => categories.data?.find((c) => c.id === cid)?.name ?? 'Categoria removida'
  const isMulheresCat = (cid: string) => {
    const c = categories.data?.find((x) => x.id === cid)
    return c?.entityType === 'native' && c.tableReference === MULHERES_TABLE
  }

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir funcionária',
      message: (
        <>
          <strong>{u.name}</strong> perderá o acesso ao sistema. Para apenas bloquear o acesso mantendo o histórico
          vinculado, prefira desativar.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await delUser.mutateAsync(u.id)
      toast.success('Funcionária excluída.')
      navigate('/admin/funcionarias', { replace: true })
    } catch (err) {
      toast.error(err)
    }
  }

  const onRemovePerm = async (p: Permission) => {
    const ok = await confirm({
      title: 'Remover permissão',
      message: `${u.name} perderá o acesso à categoria "${catName(p.categoryId)}".`,
      confirmLabel: 'Remover',
      danger: true,
    })
    if (!ok) return
    delPerm.mutate(p.id, { onSuccess: () => toast.success('Permissão removida.'), onError: (e) => toast.error(e) })
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Funcionárias', to: '/admin/funcionarias' }, { label: u.name }]}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={u.name} size="lg" />
            <span>
              {u.name}
              <span className="mt-1 block text-sm font-normal text-ink-500">{u.email}</span>
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            {!isSelf && (
              <Button variant="danger-ghost" icon={<Trash2 className="size-4" />} onClick={onDelete} loading={delUser.isPending}>
                Excluir
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {u.isGlobalAdmin ? <Badge tone="brand">Administradora</Badge> : <Badge>Equipe</Badge>}
        {u.isActive ? <Badge tone="success">Ativa</Badge> : <Badge>Inativa</Badge>}
        <Badge>Desde {formatDateTime(u.createdAt)}</Badge>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'perms', label: 'Permissões', count: perms.data?.length },
          { value: 'audit', label: 'Ações realizadas' },
        ]}
      />

      <div className="mt-6">
        {tab === 'perms' ? (
          u.isGlobalAdmin ? (
            <Alert title="Acesso total">
              Administradoras acessam todas as categorias, colunas e documentos. Permissões individuais não se aplicam.
            </Alert>
          ) : (
            <Card
              title="Acesso por categoria"
              description="O que esta funcionária pode ver e fazer em cada tipo de cadastro."
              padded={false}
              actions={
                <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setPermModal({ open: true })}>
                  Conceder acesso
                </Button>
              }
            >
              {perms.isPending ? (
                <LoadingBlock />
              ) : perms.isError ? (
                <ErrorState error={perms.error} />
              ) : perms.data.length === 0 ? (
                <EmptyState
                  icon={<ShieldCheck className="size-5" />}
                  title="Sem acesso a nenhuma categoria"
                  description="Conceda acesso para que ela possa trabalhar nos cadastros."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Ações</th>
                        <th>Colunas</th>
                        <th>Sigilo máx.</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {perms.data.map((p) => (
                        <tr key={p.id}>
                          <td className="font-medium text-ink-900">{catName(p.categoryId)}</td>
                          <td>
                            <ActionFlags p={p} />
                          </td>
                          <td>
                            <ColumnsSummary
                              cols={p.allowedColumns}
                              labelFor={isMulheresCat(p.categoryId) ? columnLabel : undefined}
                            />
                          </td>
                          <td>
                            <ConfidentialityBadge level={p.maxConfidentiality} />
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <IconButton label="Editar" onClick={() => setPermModal({ open: true, permission: p })}>
                              <Pencil className="size-4" />
                            </IconButton>
                            <IconButton label="Remover" variant="danger-ghost" onClick={() => onRemovePerm(p)}>
                              <Trash2 className="size-4" />
                            </IconButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        ) : (
          <Card title="Ações realizadas" description="Registro de auditoria das ações desta funcionária." padded={false}>
            {activities.isPending ? (
              <LoadingBlock />
            ) : activities.isError ? (
              <ErrorState error={activities.error} />
            ) : activities.data.length === 0 ? (
              <EmptyState title="Nenhuma ação registrada" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {[...activities.data]
                  .sort((a, b) => (b.occurredAt ?? b.createdAt ?? '').localeCompare(a.occurredAt ?? a.createdAt ?? ''))
                  .map((a) => {
                    // registros excluídos ainda aparecem na auditoria; o link pode dar 404
                    const href =
                      a.actionType === 'DELETED'
                        ? undefined
                        : a.entityType === 'clients'
                          ? `/mulheres/${a.entityId}`
                          : `/registros/${a.entityId}`
                    return (
                      <li key={a.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                        <span className="w-36 shrink-0 text-xs text-ink-500">{formatDateTime(a.occurredAt ?? a.createdAt)}</span>
                        <Badge tone="brand">{ACTIVITY_LABEL[a.actionType] ?? a.actionType}</Badge>
                        <span className="flex-1 truncate text-sm text-ink-700">
                          {a.description ?? ''}
                          {href && (
                            <Link to={href} className="ml-2 text-xs text-brand-700 hover:underline">
                              ver registro
                            </Link>
                          )}
                        </span>
                      </li>
                    )
                  })}
              </ul>
            )}
          </Card>
        )}
      </div>

      <UserFormModal open={editing} onClose={() => setEditing(false)} user={u} />
      <PermissionModal
        open={permModal.open}
        onClose={() => setPermModal({ open: false })}
        permission={permModal.permission}
        userId={u.id}
        categories={categories.data ?? []}
        existing={perms.data ?? []}
      />
    </>
  )
}
