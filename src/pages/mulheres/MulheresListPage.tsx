import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, UserPlus, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useMulheres } from '@/queries/records'
import { ageFrom, formatDate, formatPhone, normalize } from '@/lib/format'
import { PageHeader, Avatar } from '@/components/ui/Layout'
import { Badge, HiddenValue } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Input, SearchInput, Select } from '@/components/ui/Form'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'

export function MulheresListPage() {
  const { mulheresAccess: access } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [idade, setIdade] = useState({ min: '', max: '' })
  const [periodo, setPeriodo] = useState({ de: '', ate: '' })
  const risco = params.get('risco') ?? ''

  const setRisco = (v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set('risco', v)
    else next.delete('risco')
    setParams(next, { replace: true })
  }
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
    if (idade.min || idade.max) {
      list = list.filter((m) => {
        const a = ageFrom(m.dataNascimento)
        if (a == null) return false
        return (!idade.min || a >= Number(idade.min)) && (!idade.max || a <= Number(idade.max))
      })
    }
    if (periodo.de) list = list.filter((m) => m.createdAt.slice(0, 10) >= periodo.de)
    if (periodo.ate) list = list.filter((m) => m.createdAt.slice(0, 10) <= periodo.ate)
    return [...list].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'))
  }, [query.data, q, risco, idade, periodo])

  const activeFilters = [q.trim(), risco, idade.min || idade.max, periodo.de || periodo.ate].filter(Boolean).length
  const clearFilters = () => {
    setQ('')
    setRisco('')
    setIdade({ min: '', max: '' })
    setPeriodo({ de: '', ate: '' })
  }

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
        <div className="border-b border-ink-200 bg-ink-50/60 px-4 pt-4 pb-3">
          <div className="mb-3 flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-brand-700" />
            <h2 className="text-sm font-semibold text-ink-900">Filtros</h2>
          </div>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="mf-q" className="mb-1 block text-xs font-medium text-ink-600">
                {can.tel ? 'Nome ou telefone' : 'Nome'}
              </label>
              <SearchInput id="mf-q" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {can.risco && (
              <div>
                <label htmlFor="mf-risco" className="mb-1 block text-xs font-medium text-ink-600">
                  Situação
                </label>
                <Select id="mf-risco" value={risco} onChange={(e) => setRisco(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="1">Em situação de risco</option>
                  <option value="0">Sem risco identificado</option>
                </Select>
              </div>
            )}
            {can.nasc && (
              <div>
                <label htmlFor="mf-idade" className="mb-1 block text-xs font-medium text-ink-600">
                  Idade
                </label>
                <div className="flex items-center gap-1.5">
                  <Input id="mf-idade" type="number" min={0} placeholder="de" value={idade.min} onChange={(e) => setIdade((s) => ({ ...s, min: e.target.value }))} />
                  <span className="text-xs text-ink-400">a</span>
                  <Input type="number" min={0} placeholder="até" aria-label="Idade até" value={idade.max} onChange={(e) => setIdade((s) => ({ ...s, max: e.target.value }))} />
                </div>
              </div>
            )}
            <div>
              <label htmlFor="mf-periodo" className="mb-1 block text-xs font-medium text-ink-600">
                Cadastrada entre
              </label>
              <div className="flex items-center gap-1.5">
                <Input id="mf-periodo" type="date" className="px-2" value={periodo.de} onChange={(e) => setPeriodo((s) => ({ ...s, de: e.target.value }))} />
                <span className="text-xs text-ink-400">e</span>
                <Input type="date" className="px-2" aria-label="Cadastrada até" value={periodo.ate} onChange={(e) => setPeriodo((s) => ({ ...s, ate: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
            <span>{query.data ? `${rows.length} de ${query.data.length} cadastro(s)` : ''}</span>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 font-medium text-ink-600 hover:text-ink-900">
                <X className="size-3.5" /> Limpar {activeFilters} filtro(s)
              </button>
            )}
          </div>
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
                      className="row-link"
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
