import { useSearchParams } from 'react-router-dom'
import { CalendarClock, X } from 'lucide-react'
import { formatDate, todayISO } from '@/lib/format'

/**
 * Data de posição dos saldos (`?data=AAAA-MM-DD` na URL). Vazio = situação atual.
 * Fica na URL para o link poder ser compartilhado e sobreviver à navegação.
 */
export function useAsOfDate(): [string | undefined, (d: string | undefined) => void] {
  const [params, setParams] = useSearchParams()
  const date = params.get('data') || undefined
  const setDate = (d: string | undefined) => {
    const next = new URLSearchParams(params)
    if (d && d !== todayISO()) next.set('data', d)
    else next.delete('data')
    setParams(next, { replace: true })
  }
  return [date, setDate]
}

/** Seletor compacto "Posição em". */
export function AsOfDatePicker({ value, onChange }: { value?: string; onChange: (d: string | undefined) => void }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-md border border-ink-300 bg-white pr-1 pl-3 text-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
      <CalendarClock className="size-4 shrink-0 text-ink-400" />
      <label htmlFor="asof" className="text-ink-500">
        Posição em
      </label>
      <input
        id="asof"
        type="date"
        max={todayISO()}
        value={value ?? todayISO()}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-[8.5rem] bg-transparent font-medium text-ink-900 tabular-nums focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          aria-label="Voltar para hoje"
          title="Voltar para hoje"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** Faixa de aviso quando a tela mostra uma posição passada. */
export function AsOfBanner({ date, onReset }: { date?: string; onReset: () => void }) {
  if (!date) return null
  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-900">
      <CalendarClock className="size-4 shrink-0 text-brand-600" />
      <p className="flex-1">
        Valores no fim do dia <strong className="tabular-nums">{formatDate(date)}</strong>, pela data real das operações.
      </p>
      <button onClick={onReset} className="text-xs font-medium text-brand-700 hover:underline">
        Ver hoje
      </button>
    </div>
  )
}
