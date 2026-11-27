import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import type { TaskStatus, TaskWeekStats } from '@/api'
import { BOARD_COLUMN_LABEL, BOARD_COLUMNS, BOARD_COLUMN_STATUSES, type BoardColumn } from '@/lib/tasks'

/*
 * Gráficos do módulo de tarefas, em SVG/HTML puro.
 * Regras seguidas: série única no roxo da marca; cores do quadro validadas para daltonismo
 * (variáveis --chart-* no index.css, com valores próprios no tema escuro); texto sempre nas
 * cores de texto, nunca na cor da série; todo valor também aparece sem precisar do hover.
 */

const COLUMN_VAR: Record<BoardColumn, string> = {
  todo: 'var(--chart-todo)',
  doing: 'var(--chart-doing)',
  blocked: 'var(--chart-blocked)',
  done: 'var(--chart-done)',
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

/** Cartão de gráfico: título, subtítulo opcional e ação à direita. */
export function ChartCard({ title, subtitle, action, children, className }: { title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('card flex flex-col p-5', className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------- Situação (rosca)

/** Ponto na circunferência; ângulo 0 = topo, sentido horário. */
const polar = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const

/** Fatia de rosca entre dois ângulos (em radianos). */
function donutSlice(cx: number, cy: number, rOut: number, rIn: number, a0: number, a1: number): string {
  // uma fatia de 100% vira dois semicírculos (arco de 360° não desenha)
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    return `${donutSlice(cx, cy, rOut, rIn, 0, Math.PI)} ${donutSlice(cx, cy, rOut, rIn, Math.PI, Math.PI * 2)}`
  }
  const large = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = polar(cx, cy, rOut, a0)
  const [x1, y1] = polar(cx, cy, rOut, a1)
  const [x2, y2] = polar(cx, cy, rIn, a1)
  const [x3, y3] = polar(cx, cy, rIn, a0)
  return `M${x0},${y0} A${rOut},${rOut} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${rIn},${rIn} 0 ${large} 0 ${x3},${y3} Z`
}

/**
 * Gráfico de pizza (rosca) com as colunas do quadro; canceladas ficam fora, como no quadro.
 * O centro mostra o total ou a fatia em foco; a legenda traz nome, quantidade e %.
 */
export function BoardPie({ byStatus }: { byStatus: Partial<Record<TaskStatus, number>> }) {
  const [hover, setHover] = useState<BoardColumn | null>(null)
  const parts = BOARD_COLUMNS.map((c) => ({ col: c, value: BOARD_COLUMN_STATUSES[c].reduce((s, st) => s + (byStatus[st] ?? 0), 0) }))
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (total === 0) return <p className="py-6 text-center text-sm text-ink-400">Nenhuma tarefa no recorte.</p>
  const active = parts.find((p) => p.col === hover)

  const size = 200
  const c = size / 2
  const rOut = 92
  const rIn = 60
  let acc = 0
  const slices = parts
    .filter((p) => p.value > 0)
    .map((p) => {
      const a0 = (acc / total) * Math.PI * 2
      acc += p.value
      const a1 = (acc / total) * Math.PI * 2
      return { ...p, a0, a1 }
    })

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8">
      <div className="relative size-44 shrink-0 sm:size-48">
        <svg viewBox={`0 0 ${size} ${size}`} className="size-full overflow-visible" role="img" aria-label={parts.map((p) => `${BOARD_COLUMN_LABEL[p.col]}: ${p.value}`).join(', ')}>
          {slices.map((p) => {
            const isActive = hover === p.col
            // a fatia em foco sai um pouco para fora
            const mid = (p.a0 + p.a1) / 2
            const [dx, dy] = isActive && slices.length > 1 ? [Math.sin(mid) * 5, -Math.cos(mid) * 5] : [0, 0]
            return (
              <path
                key={p.col}
                d={donutSlice(c, c, rOut, rIn, p.a0, p.a1)}
                fill={COLUMN_VAR[p.col]}
                className={clsx('stroke-surface cursor-default outline-none transition-[opacity,transform] duration-200', hover && !isActive && 'opacity-40')}
                strokeWidth={slices.length > 1 ? 2 : 0}
                style={{ transform: `translate(${dx}px, ${dy}px)` }}
                tabIndex={0}
                aria-label={`${BOARD_COLUMN_LABEL[p.col]}: ${p.value} (${pct(p.value, total)}%)`}
                onPointerEnter={() => setHover(p.col)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(p.col)}
                onBlur={() => setHover(null)}
              />
            )
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
          <span className="text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">{active ? active.value : total}</span>
          <span className="max-w-24 text-[11px] leading-tight text-ink-500">
            {active ? `${BOARD_COLUMN_LABEL[active.col].toLowerCase()} · ${pct(active.value, total)}%` : 'tarefas'}
          </span>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-1">
        {parts.map((p) => (
          <li
            key={p.col}
            onPointerEnter={() => p.value > 0 && setHover(p.col)}
            onPointerLeave={() => setHover(null)}
            className={clsx('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors', hover === p.col ? 'bg-ink-100' : 'hover:bg-ink-50', p.value === 0 && 'opacity-60')}
          >
            <span className="size-3 shrink-0 rounded-full" style={{ background: COLUMN_VAR[p.col] }} aria-hidden />
            <span className="truncate text-ink-700">{BOARD_COLUMN_LABEL[p.col]}</span>
            <span className="ml-auto font-semibold text-ink-900 tabular-nums">{p.value}</span>
            <span className="w-10 text-right text-xs text-ink-500 tabular-nums">{pct(p.value, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}


// ---------------------------------------------------------------- Barras horizontais ordenadas

export interface RankRow {
  key: string
  label: string
  value: number
  /** Texto pequeno à direita do valor (ex.: "2 atrasadas") */
  note?: ReactNode
  to?: string
  /** Clique no nome abre detalhes (tem preferência sobre `to`) */
  onSelect?: () => void
  muted?: boolean
}

/** Barras numa só linha de base, uma cor, valor na ponta. */
export function RankedBars({ rows, empty = 'Nada no recorte.', unit }: { rows: RankRow[]; empty?: string; unit?: [string, string] }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  if (rows.length === 0 || max === 0) return <p className="py-6 text-center text-sm text-ink-400">{empty}</p>
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const label = (
          <span className={clsx('truncate text-xs', r.muted ? 'text-ink-400 italic' : 'text-ink-700')} title={r.label}>
            {r.label}
          </span>
        )
        return (
          <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,11rem)_1fr]">
            {r.onSelect ? (
              <button
                type="button"
                onClick={r.onSelect}
                className="group/name flex min-w-0 items-center gap-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                title={`Ver tarefas de ${r.label}`}
              >
                <span className="truncate text-xs font-medium text-brand-700 group-hover/name:underline">{r.label}</span>
                <ChevronRight className="size-3 shrink-0 text-ink-400 transition-transform group-hover/name:translate-x-0.5" aria-hidden />
              </button>
            ) : r.to ? (
              <Link to={r.to} className="min-w-0 truncate hover:underline">
                {label}
              </Link>
            ) : (
              label
            )}
            <div className="flex min-w-0 items-center gap-2" title={unit ? `${r.value} ${r.value === 1 ? unit[0] : unit[1]}` : String(r.value)}>
              <div className="h-2.5 rounded-r" style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%`, background: 'var(--chart-bar)' }} />
              <span className="shrink-0 text-xs font-medium text-ink-900 tabular-nums">{r.value}</span>
              {r.note && <span className="truncate text-[11px] text-ink-500">{r.note}</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- Lista de medidores (progresso por meta)

export interface MeterRow {
  key: string
  label: string
  /** 0–100; nulo = nada a contar */
  percent: number | null
  figure: ReactNode
  note?: ReactNode
  to?: string
}

function Meter({ label, percent }: { label: string; percent: number | null }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full"
      style={{ background: 'var(--chart-track)' }}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? 0}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${percent ?? 0}%`, background: percent === 100 ? 'var(--chart-done)' : 'var(--chart-bar)' }} />
    </div>
  )
}

/**
 * Lista de medidores. Com `renderDetail`, cada linha vira um acordeão que abre para baixo
 * (uma aberta por vez); o detalhe só é montado quando aberto.
 */
export function MeterList({ rows, empty = 'Nada no recorte.', renderDetail }: { rows: MeterRow[]; empty?: string; renderDetail?: (key: string) => ReactNode }) {
  const [open, setOpen] = useState<string | null>(null)
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-ink-400">{empty}</p>

  if (renderDetail) {
    return (
      <ul className="-mx-2 space-y-1">
        {rows.map((r) => {
          const isOpen = open === r.key
          return (
            <li key={r.key} className={clsx('rounded-xl transition-colors', isOpen ? 'bg-ink-50 ring-1 ring-ink-200' : 'hover:bg-ink-50')}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.key)}
                aria-expanded={isOpen}
                className="w-full rounded-xl px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ChevronRight className={clsx('size-3.5 shrink-0 text-ink-400 transition-transform duration-200', isOpen && 'rotate-90')} aria-hidden />
                    <span className="truncate font-medium text-ink-800" title={r.label}>
                      {r.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-ink-500">
                    <strong className="font-medium text-ink-900 tabular-nums">{r.percent == null ? '—' : `${r.percent}%`}</strong> · {r.figure}
                  </span>
                </div>
                <div className="pl-5">
                  <Meter label={r.label} percent={r.percent} />
                  {r.note && <p className="mt-0.5 text-[11px] text-ink-500">{r.note}</p>}
                </div>
              </button>
              {isOpen && <div className="animate-fade-in px-2 pb-3 pl-7">{renderDetail(r.key)}</div>}
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            {r.to ? (
              <Link to={r.to} className="truncate text-ink-700 hover:underline" title={r.label}>
                {r.label}
              </Link>
            ) : (
              <span className="truncate text-ink-700">{r.label}</span>
            )}
            <span className="shrink-0 text-ink-500">
              <strong className="font-medium text-ink-900 tabular-nums">{r.percent == null ? '—' : `${r.percent}%`}</strong> · {r.figure}
            </span>
          </div>
          <Meter label={r.label} percent={r.percent} />
          {r.note && <p className="mt-0.5 text-[11px] text-ink-500">{r.note}</p>}
        </li>
      ))}
    </ul>
  )
}


// ---------------------------------------------------------------- Semana a semana (colunas agrupadas)

const W = 640
const H = 200
const PAD = { top: 12, right: 8, bottom: 26, left: 28 }

function niceMax(v: number): number {
  if (v <= 4) return 4
  const step = Math.pow(10, Math.floor(Math.log10(v)))
  const n = Math.ceil(v / step)
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * step
}

const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/**
 * Criadas × concluídas por semana: duas séries, um eixo (são a mesma medida: quantidade).
 * Hover/foco em cada semana mostra as duas; a tabela dá os mesmos números sem hover.
 */
export function WeeklyChart({ weekly }: { weekly: TaskWeekStats[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  if (weekly.length === 0) return <p className="py-6 text-center text-sm text-ink-400">Sem dados no período.</p>

  const max = niceMax(Math.max(...weekly.map((w) => Math.max(w.created, w.completed))))
  const ticks = [0, max / 2, max]
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const band = innerW / weekly.length
  const barW = Math.min(12, (band - 6) / 2)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const labelEvery = weekly.length > 8 ? 2 : 1
  const totals = weekly.reduce((a, w) => ({ created: a.created + w.created, completed: a.completed + w.completed }), { created: 0, completed: 0 })
  const h = hover != null ? weekly[hover] : null

  /** Coluna com o topo arredondado (4px) e a base reta na linha de base. */
  const column = (x: number, v: number, fill: string) => {
    if (v <= 0) return null
    const top = y(v)
    const height = PAD.top + innerH - top
    const r = Math.min(4, height, barW / 2)
    return (
      <path
        d={`M${x},${top + height} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + height} Z`}
        fill={fill}
      />
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex items-center gap-4 text-xs text-ink-600">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: 'var(--chart-doing)' }} aria-hidden />
            Criadas <strong className="font-medium text-ink-900 tabular-nums">{totals.created}</strong>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: 'var(--chart-done)' }} aria-hidden />
            Concluídas <strong className="font-medium text-ink-900 tabular-nums">{totals.completed}</strong>
          </li>
        </ul>
        <button type="button" onClick={() => setTable((v) => !v)} className="text-xs text-brand-700 hover:underline">
          {table ? 'Ver gráfico' : 'Ver como tabela'}
        </button>
      </div>

      {table ? (
        <div className="max-h-56 overflow-auto">
          <table className="table-base text-xs">
            <thead>
              <tr>
                <th>Semana de</th>
                <th className="text-right">Criadas</th>
                <th className="text-right">Concluídas</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((w) => (
                <tr key={w.weekStart}>
                  <td className="tabular-nums">{shortDate(w.weekStart)}</td>
                  <td className="text-right tabular-nums">{w.created}</td>
                  <td className="text-right tabular-nums">{w.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Tarefas criadas e concluídas nas últimas ${weekly.length} semanas`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-400 text-[10px] tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            {weekly.map((w, i) => {
              const x0 = PAD.left + i * band
              const gx = x0 + (band - (barW * 2 + 2)) / 2
              return (
                <g key={w.weekStart}>
                  {hover === i && <rect x={x0} y={PAD.top} width={band} height={innerH} className="fill-ink-100" />}
                  {column(gx, w.created, 'var(--chart-doing)')}
                  {column(gx + barW + 2, w.completed, 'var(--chart-done)')}
                  {i % labelEvery === 0 && (
                    <text x={x0 + band / 2} y={H - 8} textAnchor="middle" className="fill-ink-400 text-[10px] tabular-nums">
                      {shortDate(w.weekStart)}
                    </text>
                  )}
                  {/* área de hover: a semana inteira, maior que as colunas */}
                  <rect
                    x={x0}
                    y={PAD.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`Semana de ${shortDate(w.weekStart)}: ${w.created} criadas, ${w.completed} concluídas`}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="outline-none"
                  />
                </g>
              )
            })}
          </svg>
          {h && hover != null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-xs shadow-(--shadow-pop)"
              style={{ left: `${((PAD.left + hover * band + band / 2) / W) * 100}%` }}
            >
              <p className="mb-1 text-ink-500">Semana de {shortDate(h.weekStart)}</p>
              <p className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded" style={{ background: 'var(--chart-doing)' }} />
                <strong className="text-ink-900 tabular-nums">{h.created}</strong>
                <span className="text-ink-500">criadas</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded" style={{ background: 'var(--chart-done)' }} />
                <strong className="text-ink-900 tabular-nums">{h.completed}</strong>
                <span className="text-ink-500">concluídas</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
