import { useEffect, useRef, useState } from 'react'
import { ArrowDownWideNarrow, ChevronDown, X } from 'lucide-react'
import type { CategoryField, FilterOperator, SearchFilter, SearchRequest } from '@/api'
import type { Access } from '@/auth/access'
import { Input, Select } from '@/components/ui/Form'

/** Valor digitado em um filtro: `value` para campos simples, `min`/`max` para faixas. */
interface FilterValue {
  value?: string
  min?: string
  max?: string
}

type Values = Record<string, FilterValue>

const COLLAPSED_COUNT = 8
const DEBOUNCE_MS = 350

const has = (f: CategoryField, op: FilterOperator) => f.filterOperators.includes(op)
const isRange = (f: CategoryField) => f.fieldType === 'NUMBER' || f.fieldType === 'DATE'

function parse(f: CategoryField, raw: string): unknown {
  if (f.fieldType === 'NUMBER') return Number(raw)
  if (f.fieldType === 'BOOLEAN') return raw === 'true'
  return raw
}

/** Converte os valores digitados no formato `filters` da busca, usando o operador mais natural de cada tipo. */
export function valuesToFilters(values: Values, fields: CategoryField[]): SearchFilter[] {
  const out: SearchFilter[] = []
  for (const f of fields) {
    const v = values[f.key]
    if (!v) continue
    if (isRange(f)) {
      const min = v.min?.trim()
      const max = v.max?.trim()
      if (min && max && has(f, 'BETWEEN')) out.push({ field: f.key, operator: 'BETWEEN', value: [parse(f, min), parse(f, max)] })
      else {
        if (min && has(f, 'GTE')) out.push({ field: f.key, operator: 'GTE', value: parse(f, min) })
        if (max && has(f, 'LTE')) out.push({ field: f.key, operator: 'LTE', value: parse(f, max) })
      }
      continue
    }
    const raw = v.value?.trim()
    if (!raw) continue
    if (raw === '__empty') out.push({ field: f.key, operator: 'IS_EMPTY' })
    else if (raw === '__filled') out.push({ field: f.key, operator: 'NOT_EMPTY' })
    else if (f.fieldType === 'TEXT' && has(f, 'CONTAINS')) out.push({ field: f.key, operator: 'CONTAINS', value: raw })
    else out.push({ field: f.key, operator: 'EQUALS', value: parse(f, raw) })
  }
  return out
}

function FilterControl({
  field,
  value,
  onChange,
}: {
  field: CategoryField
  value: FilterValue
  onChange: (v: FilterValue) => void
}) {
  const id = `qf-${field.key}`
  const filled = !!(value.value || value.min || value.max)

  let control: React.ReactNode
  if (isRange(field)) {
    const type = field.fieldType === 'NUMBER' ? 'number' : 'date'
    control = (
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          type={type}
          step="any"
          aria-label={`${field.label}: a partir de`}
          placeholder="de"
          value={value.min ?? ''}
          onChange={(e) => onChange({ ...value, min: e.target.value })}
          className="h-9 min-w-0 px-2 py-1.5"
        />
        <span className="text-xs text-ink-400">a</span>
        <Input
          type={type}
          step="any"
          aria-label={`${field.label}: até`}
          placeholder="até"
          value={value.max ?? ''}
          onChange={(e) => onChange({ ...value, max: e.target.value })}
          className="h-9 min-w-0 px-2 py-1.5"
        />
      </div>
    )
  } else if (field.fieldType === 'LIST' || field.fieldType === 'BOOLEAN') {
    const options =
      field.fieldType === 'BOOLEAN'
        ? [
            { value: 'true', label: 'Sim' },
            { value: 'false', label: 'Não' },
          ]
        : (field.options ?? []).map((o) => ({ value: o, label: o }))
    control = (
      <Select id={id} value={value.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} className="h-9 py-1.5">
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {has(field, 'IS_EMPTY') && <option value="__empty">Não preenchido</option>}
      </Select>
    )
  } else {
    control = (
      <Input
        id={id}
        type="search"
        placeholder="Contém…"
        value={value.value ?? ''}
        onChange={(e) => onChange({ value: e.target.value })}
        className="h-9 py-1.5"
      />
    )
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-600">
        {field.label}
        {filled && <span className="size-1.5 rounded-full bg-brand-600" aria-label="filtro ativo" />}
      </label>
      {control}
    </div>
  )
}

/**
 * Painel de filtros sempre visível para POST /dynamic-entities/search.
 * Um controle por campo legível (filtrar por coluna oculta dá 403), aplicado automaticamente.
 */
export function QuickFilters({
  fields,
  access,
  onChange,
}: {
  fields: CategoryField[]
  access: Access
  onChange: (req: Pick<SearchRequest, 'filters' | 'sort'>) => void
}) {
  const readable = fields.filter((f) => access.canReadColumn(f.key))
  const [values, setValues] = useState<Values>({})
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expanded, setExpanded] = useState(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const filters = valuesToFilters(values, readable)
  // depende do conteúdo, não da identidade dos objetos, para não disparar a cada renderização
  const payload = JSON.stringify({ filters, sort: { field: sortField, direction: sortDir } })

  useEffect(() => {
    const t = setTimeout(() => onChangeRef.current(JSON.parse(payload)), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [payload])

  const activeCount = filters.length
  const shown = expanded ? readable : readable.slice(0, COLLAPSED_COUNT)
  const hiddenCount = readable.length - shown.length

  return (
    <div className="space-y-4">
      {readable.length > 0 && (
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((f) => (
            <FilterControl
              key={f.key}
              field={f}
              value={values[f.key] ?? {}}
              onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink-100 pt-3">
        <div className="flex items-center gap-1.5">
          <ArrowDownWideNarrow className="size-4 text-ink-400" />
          <span className="text-xs text-ink-500">Ordenar por</span>
          <Select
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            className="h-8 w-auto py-1 text-xs"
            aria-label="Campo de ordenação"
          >
            <option value="createdAt">Data de cadastro</option>
            <option value="updatedAt">Última alteração</option>
            {readable.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
          <Select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
            className="h-8 w-auto py-1 text-xs"
            aria-label="Direção"
          >
            <option value="desc">Decrescente</option>
            <option value="asc">Crescente</option>
          </Select>
        </div>

        {(hiddenCount > 0 || expanded) && readable.length > COLLAPSED_COUNT && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
          >
            {expanded ? 'Menos filtros' : `Mais ${hiddenCount} filtro(s)`}
            <ChevronDown className={`size-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}

        {activeCount > 0 && (
          <button
            onClick={() => setValues({})}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-ink-900"
          >
            <X className="size-3.5" /> Limpar {activeCount} filtro(s)
          </button>
        )}
      </div>
    </div>
  )
}
