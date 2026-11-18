import type { CommitmentStatus, FinanceEntryKind, FinanceOperationMethod } from '@/api'

// ---------------------------------------------------------------- Dinheiro

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const plain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 1500.5 -> "R$ 1.500,50" */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return brl.format(value)
}

/** 1500000 -> "R$ 1,5 mi" (para espaços curtos) */
export function formatMoneyCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return Math.abs(value) < 10_000 ? brl.format(value) : brlCompact.format(value)
}

/** Com sinal explícito: "+ R$ 100,00" / "− R$ 100,00" */
export function formatSigned(value: number | null | undefined): string {
  if (value == null || value === 0) return '—'
  return `${value > 0 ? '+' : '−'} ${brl.format(Math.abs(value))}`
}

/** 1500.5 -> "1.500,50" (sem símbolo, para inputs) */
export function formatAmountPlain(value: number | null | undefined): string {
  if (value == null) return ''
  return plain.format(value)
}

/** Soma em centavos para não acumular erro de ponto flutuante. */
export function sumMoney(values: (number | null | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + Math.round((v ?? 0) * 100), 0) / 100
}

export const subMoney = (a: number, b: number) => (Math.round(a * 100) - Math.round(b * 100)) / 100

/** Percentual seguro (0–100). */
export function pct(part: number, total: number): number {
  if (!total || total <= 0) return 0
  return Math.max(0, Math.min(100, (part / total) * 100))
}

export function formatPct(part: number, total: number): string {
  if (!total) return '0%'
  const p = (part / total) * 100
  return `${p < 10 && p > 0 ? p.toFixed(1).replace('.', ',') : Math.round(p)}%`
}

// ---------------------------------------------------------------- Rótulos

export const METHOD_LABEL: Record<FinanceOperationMethod, string> = {
  OPENING: 'Valor inicial',
  DISTRIBUTION: 'Distribuição',
  TRANSFER_BETWEEN_SUB_ACTIONS: 'Transferência entre subações',
  TRANSFER_BETWEEN_ACTIONS: 'Transferência entre ações',
  TAC: 'Termo aditivo (TAC)',
  COMMITMENT: 'Empenho',
  COMMITMENT_CANCELLATION: 'Anulação de empenho',
  LIQUIDATION: 'Liquidação',
  PAYMENT: 'Pagamento',
}

/** Método A/B/C, quando houver */
export const METHOD_TAG: Partial<Record<FinanceOperationMethod, string>> = {
  TRANSFER_BETWEEN_SUB_ACTIONS: 'Método A',
  TRANSFER_BETWEEN_ACTIONS: 'Método B',
  TAC: 'Método C',
}

export const METHOD_GROUPS: { label: string; methods: FinanceOperationMethod[] }[] = [
  { label: 'Orçamento', methods: ['OPENING', 'DISTRIBUTION', 'TRANSFER_BETWEEN_SUB_ACTIONS', 'TRANSFER_BETWEEN_ACTIONS', 'TAC'] },
  { label: 'Execução', methods: ['COMMITMENT', 'COMMITMENT_CANCELLATION', 'LIQUIDATION', 'PAYMENT'] },
]

export const ENTRY_KIND_LABEL: Record<FinanceEntryKind, string> = {
  BUDGET: 'Dotação',
  COMMITTED: 'Empenhado',
  LIQUIDATED: 'Liquidado',
  PAID: 'Pago',
}

export const COMMITMENT_STATUS_LABEL: Record<CommitmentStatus, string> = {
  TO_LIQUIDATE: 'A liquidar',
  TO_PAY: 'A pagar',
  PAID: 'Pago',
  CANCELLED: 'Anulado',
}

export const COMMITMENT_STATUS_TONE: Record<CommitmentStatus, 'warning' | 'brand' | 'success' | 'neutral'> = {
  TO_LIQUIDATE: 'warning',
  TO_PAY: 'brand',
  PAID: 'success',
  CANCELLED: 'neutral',
}

// ---------------------------------------------------------------- Cores da execução
// Escala do roxo institucional: quanto mais avançada a etapa, mais escura.

export const STAGE = {
  paid: { label: 'Pago', bar: 'bg-brand-800', dot: 'bg-brand-800' },
  liquidated: { label: 'Liquidado', bar: 'bg-brand-500', dot: 'bg-brand-500' },
  committed: { label: 'Empenhado', bar: 'bg-brand-300', dot: 'bg-brand-300' },
  available: { label: 'Disponível', bar: 'bg-ink-100', dot: 'bg-ink-200' },
} as const
