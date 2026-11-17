import type { AllowedColumns } from '@/api'
import { Badge } from '@/components/ui/Badge'

export function ActionFlags({ p }: { p: { canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean } }) {
  const items = [
    ['Ler', p.canRead],
    ['Criar', p.canCreate],
    ['Editar', p.canUpdate],
    ['Excluir', p.canDelete],
  ] as const
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(([label, on]) => (
        <Badge key={label} tone={on ? 'brand' : 'neutral'} className={on ? '' : 'line-through opacity-60'}>
          {label}
        </Badge>
      ))}
    </div>
  )
}

export function ColumnsSummary({
  cols,
  labelFor = (c) => c,
  activityTypes,
}: {
  cols: AllowedColumns | null
  labelFor?: (c: string) => string
  /** keys dos tipos de registro liberados; null/vazio = todos */
  activityTypes?: string[] | null
}) {
  const fmt = (list?: string[]) =>
    list === undefined ? 'todas' : list.length === 0 ? 'nenhuma' : list.map(labelFor).join(', ')
  return (
    <div className="space-y-0.5 text-xs text-ink-600">
      <p>
        <span className="text-ink-400">Leitura:</span> {fmt(cols?.read)}
      </p>
      <p>
        <span className="text-ink-400">Escrita:</span> {fmt(cols?.write)}
      </p>
      {activityTypes !== undefined && (
        <p>
          <span className="text-ink-400">Registros:</span>{' '}
          {activityTypes?.length ? activityTypes.join(', ') : 'todos os tipos'}
        </p>
      )}
    </div>
  )
}
