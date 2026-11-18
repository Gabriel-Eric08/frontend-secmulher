import clsx from 'clsx'
import { STAGE, formatMoney, formatPct, pct } from '@/lib/finance'

interface Execution {
  /** Base da barra: dotação (subação) ou valor total (ação) */
  total: number
  committed: number
  liquidated: number
  paid: number
}

/**
 * Barra empilhada da execução da despesa: pago ⊂ liquidado ⊂ empenhado ⊂ total.
 * Cada faixa mostra só a parte exclusiva da etapa, então as larguras somam o empenhado.
 */
export function ExecutionBar({
  total,
  committed,
  liquidated,
  paid,
  size = 'md',
  className,
}: Execution & { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const segments = [
    { key: 'paid', width: pct(paid, total), cls: STAGE.paid.bar },
    { key: 'liquidated', width: pct(liquidated - paid, total), cls: STAGE.liquidated.bar },
    { key: 'committed', width: pct(committed - liquidated, total), cls: STAGE.committed.bar },
  ]
  return (
    <div
      className={clsx(
        'flex w-full overflow-hidden rounded-full bg-ink-100',
        { sm: 'h-1.5', md: 'h-2', lg: 'h-3' }[size],
        className,
      )}
      role="img"
      aria-label={`Empenhado ${formatPct(committed, total)}, liquidado ${formatPct(liquidated, total)}, pago ${formatPct(paid, total)}`}
      title={`Empenhado ${formatMoney(committed)} · Liquidado ${formatMoney(liquidated)} · Pago ${formatMoney(paid)}`}
    >
      {segments.map((s) => (
        <div key={s.key} className={clsx('h-full transition-[width] duration-500', s.cls)} style={{ width: `${s.width}%` }} />
      ))}
    </div>
  )
}

/** Legenda com valores e percentuais de cada etapa. */
export function ExecutionLegend({ total, committed, liquidated, paid, available }: Execution & { available: number }) {
  const items = [
    { ...STAGE.paid, value: paid },
    { ...STAGE.liquidated, value: liquidated },
    { ...STAGE.committed, value: committed },
    { ...STAGE.available, value: available },
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="flex items-center gap-1.5 text-xs text-ink-500">
            <span className={clsx('size-2 rounded-full', it.dot)} />
            {it.label}
            <span className="text-ink-400 tabular-nums">{formatPct(it.value, total)}</span>
          </dt>
          <dd className="mt-0.5 truncate text-sm font-semibold text-ink-900 tabular-nums">{formatMoney(it.value)}</dd>
        </div>
      ))}
    </dl>
  )
}
