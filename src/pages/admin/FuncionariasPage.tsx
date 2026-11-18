import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useUsers } from '@/queries/admin'
import { formatDate, normalize } from '@/lib/format'
import { Avatar, PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchInput, Select } from '@/components/ui/Form'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { UserFormModal } from '@/components/admin/UserFormModal'

export function FuncionariasPage() {
  const navigate = useNavigate()
  const users = useUsers()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => {
    let list = users.data ?? []
    if (q.trim()) {
      const n = normalize(q.trim())
      list = list.filter((u) => normalize(u.name).includes(n) || normalize(u.email).includes(n))
    }
    if (status === 'active') list = list.filter((u) => u.isActive)
    if (status === 'inactive') list = list.filter((u) => !u.isActive)
    if (status === 'admin') list = list.filter((u) => u.isGlobalAdmin)
    return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [users.data, q, status])

  return (
    <>
      <PageHeader
        title="Funcionárias"
        description="Equipe com acesso ao sistema e seus perfis."
        actions={
          <Button icon={<UserPlus className="size-4" />} onClick={() => setCreating(true)}>
            Nova funcionária
          </Button>
        }
      />
      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row">
          <SearchInput
            placeholder="Buscar por nome ou e-mail"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:max-w-sm sm:flex-1"
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
            <option value="">Todas</option>
            <option value="active">Ativas</option>
            <option value="inactive">Inativas</option>
            <option value="admin">Administradoras</option>
          </Select>
        </div>
        {users.isPending ? (
          <LoadingBlock />
        ) : users.isError ? (
          <ErrorState error={users.error} onRetry={() => users.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhuma funcionária encontrada" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Perfil</th>
                  <th>Situação</th>
                  <th className="text-right">Desde</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="row-link" onClick={() => navigate(`/admin/funcionarias/${u.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <p className="font-medium text-ink-900">{u.name}</p>
                          <p className="text-xs text-ink-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>{u.isGlobalAdmin ? <Badge tone="brand">Administradora</Badge> : <Badge>Equipe</Badge>}</td>
                    <td>{u.isActive ? <Badge tone="success">Ativa</Badge> : <Badge tone="neutral">Inativa</Badge>}</td>
                    <td className="text-right text-xs text-ink-500">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <UserFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(u) => navigate(`/admin/funcionarias/${u.id}`)}
      />
    </>
  )
}
