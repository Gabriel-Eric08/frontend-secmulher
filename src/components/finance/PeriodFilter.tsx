import { Input } from '@/components/ui/Form'

/** Filtro de período (pela data real das operações). */
export function PeriodFilter({
  value,
  onChange,
}: {
  value: { from: string; to: string }
  onChange: (v: { from: string; to: string }) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-3 text-sm text-ink-500">
      <span>De</span>
      <Input type="date" className="w-auto" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      <span>até</span>
      <Input type="date" className="w-auto" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      {(value.from || value.to) && (
        <button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => onChange({ from: '', to: '' })}>
          Limpar
        </button>
      )}
    </div>
  )
}
