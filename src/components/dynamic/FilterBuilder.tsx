import { useState } from 'react'
import { ArrowDownWideNarrow, Filter, Plus, X } from 'lucide-react'
import type { CategoryField, FilterOperator, SearchFilter, SearchRequest } from '@/api'
import type { Access } from '@/auth/access'
import { OPERATOR_LABEL } from '@/lib/format'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'

export interface DraftFilter {
  id: number
  field: string
  operator: FilterOperator
  value: string
  value2: string
  values: string[]
}

let seq = 0
const NO_VALUE: FilterOperator[] = ['IS_EMPTY', 'NOT_EMPTY']

function newDraft(field?: CategoryField): DraftFilter {
  return {
    id: ++seq,
    field: field?.key ?? '',
    operator: field?.filterOperators[0] ?? 'EQUALS',
    value: '',
    value2: '',
    values: [],
  }
}

function parseValue(field: CategoryField, raw: string): unknown {
  if (field.fieldType === 'NUMBER') return raw === '' ? raw : Number(raw)
  if (field.fieldType === 'BOOLEAN') return raw === 'true'
  return raw
}

/** Converte os rascunhos da UI para o formato de `filters` da API. */
export function draftsToFilters(drafts: DraftFilter[], fields: CategoryField[]): SearchFilter[] {
  const out: SearchFilter[] = []
  for (const d of drafts) {
    const f = fields.find((x) => x.key === d.field)
    if (!f) continue
    if (NO_VALUE.includes(d.operator)) out.push({ field: d.field, operator: d.operator })
    else if (d.operator === 'BETWEEN') {
      if (d.value === '' || d.value2 === '') continue
      out.push({ field: d.field, operator: d.operator, value: [parseValue(f, d.value), parseValue(f, d.value2)] })
    } else if (d.operator === 'IN') {
      const vals = f.fieldType === 'LIST' ? d.values : d.value.split(',').map((s) => s.trim()).filter(Boolean)
      if (vals.length === 0) continue
      out.push({ field: d.field, operator: d.operator, value: vals })
    } else {
      if (d.value === '') continue
      out.push({ field: d.field, operator: d.operator, value: parseValue(f, d.value) })
    }
  }
  return out
}

function ValueInput({
  field,
  draft,
  onChange,
}: {
  field: CategoryField
  draft: DraftFilter
  onChange: (patch: Partial<DraftFilter>) => void
}) {
  if (NO_VALUE.includes(draft.operator)) return null
  const type = field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'

  if (field.fieldType === 'BOOLEAN') {
    return (
      <Select value={draft.value} onChange={(e) => onChange({ value: e.target.value })} className="sm:w-40">
        <option value="">Selecione…</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </Select>
    )
  }

  if (field.fieldType === 'LIST' && draft.operator === 'IN') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {(field.options ?? []).map((o) => {
          const active = draft.values.includes(o)
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange({ values: active ? draft.values.filter((v) => v !== o) : [...draft.values, o] })}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                active ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink-300 text-ink-600 hover:border-ink-400'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
    )
  }

  if (field.fieldType === 'LIST') {
    return (
      <Select value={draft.value} onChange={(e) => onChange({ value: e.target.value })} className="sm:w-48">
        <option value="">Selecione…</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    )
  }

  if (draft.operator === 'BETWEEN') {
    return (
      <div className="flex items-center gap-2">
        <Input type={type} value={draft.value} onChange={(e) => onChange({ value: e.target.value })} placeholder="de" className="sm:w-36" />
        <span className="text-xs text-ink-500">e</span>
        <Input type={type} value={draft.value2} onChange={(e) => onChange({ value2: e.target.value })} placeholder="até" className="sm:w-36" />
      </div>
    )
  }

  return (
    <Input
      type={type}
      value={draft.value}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder={draft.operator === 'IN' ? 'valores separados por vírgula' : 'valor'}
      className="sm:w-56"
    />
  )
}

/**
 * Construtor de filtros para POST /dynamic-entities/search.
 * Só oferece campos legíveis: filtrar/ordenar por coluna oculta dá 403 no backend.
 */
export function FilterBuilder({
  fields,
  access,
  onApply,
}: {
  fields: CategoryField[]
  access: Access
  onApply: (req: Pick<SearchRequest, 'filters' | 'sort'>) => void
}) {
  const readable = fields.filter((f) => access.canReadColumn(f.key))
  const [drafts, setDrafts] = useState<DraftFilter[]>([])
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const patch = (id: number, p: Partial<DraftFilter>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d)))

  const apply = (ds = drafts) =>
    onApply({ filters: draftsToFilters(ds, fields), sort: { field: sortField, direction: sortDir } })

  const clear = () => {
    setDrafts([])
    onApply({ filters: [], sort: { field: sortField, direction: sortDir } })
  }

  return (
    <div className="space-y-3">
      {drafts.map((d) => {
        const field = readable.find((f) => f.key === d.field) ?? readable[0]
        if (!field) return null
        return (
          <div key={d.id} className="flex flex-col gap-2 rounded-md border border-ink-200 bg-ink-50/60 p-2.5 sm:flex-row sm:items-center">
            <Select
              value={field.key}
              onChange={(e) => {
                const f = readable.find((x) => x.key === e.target.value)!
                patch(d.id, { field: f.key, operator: f.filterOperators[0], value: '', value2: '', values: [] })
              }}
              className="sm:w-48"
            >
              {readable.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </Select>
            <Select
              value={d.operator}
              onChange={(e) => patch(d.id, { operator: e.target.value as FilterOperator })}
              className="sm:w-44"
            >
              {field.filterOperators.map((op) => (
                <option key={op} value={op}>
                  {OPERATOR_LABEL[op]}
                </option>
              ))}
            </Select>
            <div className="flex-1">
              <ValueInput field={field} draft={d} onChange={(p) => patch(d.id, p)} />
            </div>
            <IconButton
              label="Remover filtro"
              onClick={() => {
                const next = drafts.filter((x) => x.id !== d.id)
                setDrafts(next)
                apply(next)
              }}
            >
              <X className="size-4" />
            </IconButton>
          </div>
        )
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus className="size-4" />}
          disabled={readable.length === 0 || drafts.length >= 30}
          onClick={() => setDrafts((ds) => [...ds, newDraft(readable[0])])}
        >
          Adicionar filtro
        </Button>

        <div className="flex items-center gap-1.5">
          <ArrowDownWideNarrow className="size-4 text-ink-400" />
          <Select value={sortField} onChange={(e) => setSortField(e.target.value)} className="h-8 py-1 text-xs sm:w-44">
            <option value="createdAt">Data de cadastro</option>
            <option value="updatedAt">Última alteração</option>
            {readable.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </Select>
          <Select value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')} className="h-8 py-1 text-xs sm:w-32">
            <option value="desc">Decrescente</option>
            <option value="asc">Crescente</option>
          </Select>
        </div>

        <div className="ml-auto flex gap-2">
          {drafts.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clear}>
              Limpar
            </Button>
          )}
          <Button size="sm" icon={<Filter className="size-4" />} onClick={() => apply()}>
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  )
}
