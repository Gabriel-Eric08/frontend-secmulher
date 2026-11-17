import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, Filter, Plus } from 'lucide-react'
import type { SearchRequest } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useCategory, useFields } from '@/queries/admin'
import { useEntitySearch } from '@/queries/records'
import { formatDate, formatValue, normalize } from '@/lib/format'
import { PageHeader } from '@/components/ui/Layout'
import { HiddenValue } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/Form'
import { Alert, EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { DynamicValue } from '@/components/dynamic/DynamicField'
import { FilterBuilder } from '@/components/dynamic/FilterBuilder'

const MAX_COLUMNS = 6

export function CadastroListPage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const { accessFor } = useAuth()
  const access = accessFor(categoryId!)
  const category = useCategory(categoryId)
  const fields = useFields(categoryId, access.canRead)
  const [criteria, setCriteria] = useState<Pick<SearchRequest, 'filters' | 'sort'>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [q, setQ] = useState('')

  const request = useMemo<SearchRequest | null>(
    () => (categoryId && access.canRead ? { categoryId, ...criteria } : null),
    [categoryId, access.canRead, criteria],
  )
  const search = useEntitySearch(request)

  const readableFields = (fields.data ?? []).filter((f) => access.canReadColumn(f.key))
  const columns = readableFields.slice(0, MAX_COLUMNS)

  const rows = useMemo(() => {
    const list = search.data ?? []
    if (!q.trim()) return list
    const n = normalize(q.trim())
    return list.filter((e) => Object.values(e.customFields).some((v) => normalize(formatValue(v)).includes(n)))
  }, [search.data, q])

  if (!access.canRead) return <ForbiddenState />
  if (category.isError) return <ErrorState error={category.error} />

  const activeFilters = criteria.filters?.length ?? 0
  const base = `/cadastros/${categoryId}`

  return (
    <>
      <PageHeader
        title={category.data?.name ?? 'Cadastro'}
        description={category.data && !category.data.isActive ? 'Categoria inativa: não recebe novos registros.' : undefined}
        actions={
          access.canCreate &&
          category.data?.isActive && (
            <ButtonLink to={`${base}/novo`} icon={<Plus className="size-4" />}>
              Novo registro
            </ButtonLink>
          )
        }
      />

      {fields.isSuccess && fields.data.length === 0 && (
        <div className="mb-4">
          <Alert tone="warning" title="Esta categoria ainda não tem campos">
            {access.isAdmin ? 'Defina os campos do formulário em Administração › Categorias e campos.' : 'Procure a administração.'}
          </Alert>
        </div>
      )}

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center">
          <SearchInput
            placeholder="Buscar nos resultados"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:max-w-sm sm:flex-1"
          />
          <Button
            variant={showFilters || activeFilters ? 'secondary' : 'ghost'}
            size="sm"
            icon={<Filter className="size-4" />}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filtros{activeFilters ? ` (${activeFilters})` : ''}
            <ChevronDown className={`size-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          <p className="text-xs text-ink-500 sm:ml-auto">{search.data ? `${rows.length} registro(s)` : ''}</p>
        </div>

        {showFilters && fields.data && (
          <div className="border-b border-ink-100 bg-ink-50/40 p-4">
            <FilterBuilder fields={fields.data} access={access} onApply={setCriteria} />
          </div>
        )}

        {search.isPending || fields.isPending ? (
          <LoadingBlock />
        ) : search.isError ? (
          <ErrorState error={search.error} onRetry={() => search.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={activeFilters || q ? 'Nenhum resultado' : 'Nenhum registro'}
            description={activeFilters || q ? 'Ajuste a busca ou os filtros.' : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  {columns.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                  <th className="text-right">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="cursor-pointer hover:bg-ink-50" onClick={() => navigate(`${base}/${e.id}`)}>
                    {columns.map((f, i) => (
                      <td key={f.key} className={i === 0 ? 'font-medium text-ink-900' : 'text-ink-600'}>
                        {e.hiddenFields?.includes(f.key) ? <HiddenValue /> : <DynamicValue field={f} value={e.customFields[f.key]} />}
                      </td>
                    ))}
                    {columns.length === 0 && <td className="text-ink-500">Registro {e.id.slice(0, 8)}</td>}
                    <td className="text-right text-xs text-ink-500">{formatDate(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
