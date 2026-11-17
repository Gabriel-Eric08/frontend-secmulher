import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useMulheres } from '@/queries/records'
import { ageFrom, formatDate, formatPhone, normalize } from '@/lib/format'
import { PageHeader, Avatar } from '@/components/ui/Layout'
import { Badge, HiddenValue } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { SearchInput, Select } from '@/components/ui/Form'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'

export function MulheresListPage() {
  const { mulheresAccess: access } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const risco = params.get('risco') ?? ''
  const query = useMulheres(access.canRead)

  const can = {
    nome: access.canReadColumn('nome'),
    nasc: access.canReadColumn('data_nascimento'),
    tel: access.canReadColumn('telefone'),
    risco: access.canReadColumn('sob_risco'),
  }

  const rows = useMemo(() => {
    let list = query.data ?? []
    if (q.trim()) {
      const n = normalize(q.trim())
      const digits = q.replace(/\D/g, '')
      list = list.filter(
        (m) => normalize(m.nome ?? '').includes(n) || (digits && (m.telefone ?? '').replace(/\D/g, '').includes(digits)),
      )
    }
    if (risco === '1') list = list.filter((m) => m.sobRisco === true)
    if (risco === '0') list = list.filter((m) => m.sobRisco === false)
    return [...list].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))
  }, [query.data, q, risco])

  if (!access.canRead) return <ForbiddenState />

  return (
    <>
      <PageHeader
        title="Mulheres atendidas"
        description="Cadastro das mulheres acompanhadas pela Secretaria."
        actions={
          access.canCreate && (
            <ButtonLink to="/mulheres/nova" icon={<UserPlus className="size-4" />}>
              Novo cadastro
            </ButtonLink>
          )
        }
      />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center">
          <SearchInput
            placeholder={can.tel ? 'Buscar por nome ou telefone' : 'Buscar por nome'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:max-w-sm sm:flex-1"
          />
          {can.risco && (
            <Select
              value={risco}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                if (e.target.value) next.set('risco', e.target.value)
                else next.delete('risco')
                setParams(next, { replace: true })
              }}
              className="sm:w-52"
            >
              <option value="">Todas as situações</option>
              <option value="1">Em situação de risco</option>
              <option value="0">Sem risco identificado</option>
            </Select>
          )}
          <p className="text-xs text-ink-500 sm:ml-auto">
            {query.data ? `${rows.length} de ${query.data.length}` : ''}
          </p>
        </div>

        {query.isPending ? (
          <LoadingBlock />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={query.data.length ? 'Nenhum resultado' : 'Nenhuma mulher cadastrada'}
            description={query.data.length ? 'Ajuste a busca ou os filtros.' : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Nascimento</th>
                  <th>Telefone</th>
                  <th>Situação</th>
                  <th className="text-right">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const age = ageFrom(m.dataNascimento)
                  return (
                    <tr
                      key={m.id}
                      className="cursor-pointer hover:bg-ink-50"
                      onClick={() => navigate(`/mulheres/${m.id}`)}
                    >
                      <td>
                        <Link
                          to={`/mulheres/${m.id}`}
                          className="flex items-center gap-3 font-medium text-ink-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Avatar name={m.nome} size="sm" />
                          {can.nome ? m.nome : <HiddenValue />}
                        </Link>
                      </td>
                      <td className="text-ink-600">
                        {can.nasc ? (
                          m.dataNascimento ? (
                            <>
                              {formatDate(m.dataNascimento)}
                              {age != null && <span className="ml-1.5 text-xs text-ink-400">({age} anos)</span>}
                            </>
                          ) : (
                            '—'
                          )
                        ) : (
                          <HiddenValue />
                        )}
                      </td>
                      <td className="text-ink-600 tabular-nums">{can.tel ? formatPhone(m.telefone) : <HiddenValue />}</td>
                      <td>
                        {!can.risco ? (
                          <HiddenValue />
                        ) : m.sobRisco ? (
                          <Badge tone="danger">Em risco</Badge>
                        ) : (
                          <Badge>Acompanhamento</Badge>
                        )}
                      </td>
                      <td className="text-right text-xs text-ink-500">{formatDate(m.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
