import type { CategoryField, CustomFieldValue } from '@/api'
import { formatValue } from '@/lib/format'
import { Field, Input, Select } from '@/components/ui/Form'
import { Badge } from '@/components/ui/Badge'

/** Controle de formulário gerado a partir da definição do campo. */
export function DynamicFieldInput({
  field,
  value,
  onChange,
  error,
  disabled,
  locked,
}: {
  field: CategoryField
  value: CustomFieldValue | undefined
  onChange: (v: CustomFieldValue) => void
  error?: string
  disabled?: boolean
  locked?: boolean
}) {
  const id = `f-${field.key}`
  const common = { id, disabled, invalid: !!error }

  let control: React.ReactNode
  switch (field.fieldType) {
    case 'NUMBER':
      control = (
        <Input
          {...common}
          type="number"
          step="any"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )
      break
    case 'DATE':
      control = (
        <Input {...common} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
      )
      break
    case 'BOOLEAN':
      control = (
        <Select
          {...common}
          value={value === true ? 'true' : value === false ? 'false' : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}
        >
          <option value="">—</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </Select>
      )
      break
    case 'LIST':
      control = (
        <Select {...common} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Selecione…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      )
      break
    default:
      control = <Input {...common} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
  }

  return (
    <Field label={field.label} htmlFor={id} required={field.isRequired} error={error} locked={locked}>
      {control}
    </Field>
  )
}

/** Exibição de um valor de campo dinâmico. */
export function DynamicValue({ field, value }: { field?: CategoryField; value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-ink-400">—</span>
  if (field?.fieldType === 'BOOLEAN' || typeof value === 'boolean')
    return <Badge tone={value ? 'success' : 'neutral'}>{value ? 'Sim' : 'Não'}</Badge>
  if (field?.fieldType === 'LIST') return <Badge tone="brand">{String(value)}</Badge>
  return <>{formatValue(value)}</>
}
