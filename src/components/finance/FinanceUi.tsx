import type { ReactNode } from 'react'
import clsx from 'clsx'
import {
  ArrowLeftRight,
  Ban,
  Banknote,
  CircleDollarSign,
  FilePlus2,
  FileCheck2,
  PlusCircle,
  Shuffle,
  SplitSquareHorizontal,
} from 'lucide-react'
import type { CommitmentStatus, FinanceAction, FinanceOperationMethod } from '@/api'
import { COMMITMENT_STATUS_LABEL, COMMITMENT_STATUS_TONE, formatMoney } from '@/lib/finance'
import { todayISO } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Select } from '@/components/ui/Form'

/** Código de ação/subação/empenho em fonte monoespaçada. */
export function CodeTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-600',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Valor monetário com dígitos tabulares; `muted` quando zero. */
export function Money({ value, className, strong }: { value: number; className?: string; strong?: boolean }) {
  return (
    <span className={clsx('tabular-nums', value === 0 && 'text-ink-400', strong && 'font-semibold', className)}>
      {formatMoney(value)}
    </span>
  )
}

/** Métrica rótulo/valor para faixas de indicadores. */
export function Metric({
  label,
  value,
  hint,
  emphasis,
  tone = 'default',
}: {
  label: string
  value: number
  hint?: ReactNode
  emphasis?: boolean
  tone?: 'default' | 'brand' | 'warning'
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p
        className={clsx(
          'mt-1 truncate font-semibold tracking-tight tabular-nums',
          emphasis ? 'text-2xl' : 'text-lg',
          { default: 'text-ink-900', brand: 'text-brand-700', warning: 'text-amber-700' }[tone],
        )}
        title={formatMoney(value)}
      >
        {formatMoney(value)}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  )
}

const METHOD_ICON: Record<FinanceOperationMethod, React.ComponentType<{ className?: string }>> = {
  OPENING: CircleDollarSign,
  DISTRIBUTION: SplitSquareHorizontal,
  TRANSFER_BETWEEN_SUB_ACTIONS: ArrowLeftRight,
  TRANSFER_BETWEEN_ACTIONS: Shuffle,
  TAC: PlusCircle,
  COMMITMENT: FilePlus2,
  COMMITMENT_CANCELLATION: Ban,
  LIQUIDATION: FileCheck2,
  PAYMENT: Banknote,
}

const METHOD_TONE: Record<FinanceOperationMethod, string> = {
  OPENING: 'bg-brand-50 text-brand-700',
  DISTRIBUTION: 'bg-brand-50 text-brand-700',
  TRANSFER_BETWEEN_SUB_ACTIONS: 'bg-sky-50 text-sky-700',
  TRANSFER_BETWEEN_ACTIONS: 'bg-sky-50 text-sky-700',
  TAC: 'bg-emerald-50 text-emerald-700',
  COMMITMENT: 'bg-amber-50 text-amber-700',
  COMMITMENT_CANCELLATION: 'bg-red-50 text-red-600',
  LIQUIDATION: 'bg-brand-100 text-brand-700',
  PAYMENT: 'bg-brand-700 text-white',
}

export function MethodIcon({ method, size = 'md' }: { method: FinanceOperationMethod; size?: 'sm' | 'md' }) {
  const Icon = METHOD_ICON[method]
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        size === 'sm' ? 'size-7' : 'size-9',
        METHOD_TONE[method],
      )}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} />
    </span>
  )
}

export function CommitmentStatusBadge({ status }: { status: CommitmentStatus }) {
  return <Badge tone={COMMITMENT_STATUS_TONE[status]}>{COMMITMENT_STATUS_LABEL[status]}</Badge>
}

export function InactiveBadge({ active }: { active: boolean }) {
  return active ? null : <Badge>Inativa</Badge>
}

/** Data real da operação: padrão hoje, nunca futura. */
export function OperationDateField({
  value,
  onChange,
  min,
  error,
  id = 'op-date',
  label = 'Data da operação',
}: {
  value: string
  onChange: (v: string) => void
  min?: string
  error?: string
  id?: string
  label?: string
}) {
  return (
    <Field label={label} htmlFor={id} error={error} hint="Data em que de fato aconteceu. Não pode ser futura.">
      <Input
        id={id}
        type="date"
        value={value}
        max={todayISO()}
        min={min}
        invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

/**
 * Seleção de subação agrupada por ação, com o disponível de cada uma.
 * `filter` restringe as opções (ex.: só da mesma ação, só ativas).
 */
export function SubActionSelect({
  id,
  actions,
  value,
  onChange,
  filter,
  invalid,
  placeholder = 'Selecione a subação…',
  disabled,
}: {
  id?: string
  actions: FinanceAction[]
  value: string
  onChange: (id: string) => void
  filter?: (s: FinanceAction['subActions'][number], a: FinanceAction) => boolean
  invalid?: boolean
  placeholder?: string
  disabled?: boolean
}) {
  const groups = actions
    .map((a) => ({ action: a, subs: a.subActions.filter((s) => (filter ? filter(s, a) : true)) }))
    .filter((g) => g.subs.length > 0)
  return (
    <Select id={id} value={value} invalid={invalid} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {groups.map(({ action, subs }) => (
        <optgroup key={action.id} label={`${action.code} · ${action.name}`}>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} · {s.name} — disponível {formatMoney(s.availableAmount)}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  )
}

/** Linha de resumo "antes → depois" usada nos modais de operação. */
export function ImpactRow({ label, before, after }: { label: ReactNode; before: number; after: number }) {
  const negative = after < 0
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="min-w-0 truncate text-ink-600">{label}</span>
      <span className="flex shrink-0 items-center gap-2 tabular-nums">
        <span className="text-ink-400">{formatMoney(before)}</span>
        <span className="text-ink-300">→</span>
        <span className={clsx('font-semibold', negative ? 'text-red-600' : 'text-ink-900')}>{formatMoney(after)}</span>
      </span>
    </div>
  )
}

export function ImpactBox({ title = 'Resultado', children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-50 px-4 py-2.5">
      <p className="mb-0.5 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">{title}</p>
      <div className="divide-y divide-ink-200/70">{children}</div>
    </div>
  )
}
