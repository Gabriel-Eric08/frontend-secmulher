import type { ActivityType, ConfidentialityLevel, FieldType, FilterOperator } from '@/api'

// ---------------------------------------------------------------- Datas

/** "1990-05-10" -> "10/05/1990" sem conversão de fuso */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return value
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} dia(s)`
  return formatDateTime(value)
}

export function ageFrom(birth: string | null | undefined): number | null {
  if (!birth) return null
  const b = new Date(`${birth}T00:00:00`)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

/** "AAAA-MM-DDTHH:mm" no fuso local, para <input type="datetime-local"> */
export function nowLocalInput(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function todayISO(): string {
  return nowLocalInput().slice(0, 10)
}

// ---------------------------------------------------------------- Outros formatos

export function formatPhone(value: string | null | undefined): string {
  if (!value) return '—'
  const d = value.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return value
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value)
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// ---------------------------------------------------------------- Rótulos

export const CONFIDENTIALITY_LABEL: Record<ConfidentialityLevel, string> = {
  INTERNAL: 'Interno',
  RESTRICTED: 'Restrito',
  CONFIDENTIAL: 'Sigiloso',
}

export const CONFIDENTIALITY_HINT: Record<ConfidentialityLevel, string> = {
  INTERNAL: 'Visível a toda a equipe com acesso ao registro',
  RESTRICTED: 'Somente perfis autorizados a documentos restritos',
  CONFIDENTIAL: 'Somente perfis autorizados a documentos sigilosos',
}

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  MANUAL: 'Registro',
  TRIAGE: 'Triagem',
  SERVICE: 'Atendimento',
  FOLLOW_UP: 'Acompanhamento',
  NOTE: 'Anotação',
  CREATED: 'Cadastro criado',
  UPDATED: 'Dados alterados',
  DELETED: 'Registro excluído',
  FILE_UPLOADED: 'Documento anexado',
  FILE_UPDATED: 'Sigilo de documento alterado',
  FILE_REMOVED: 'Documento removido',
  FILE_DOWNLOADED: 'Documento baixado',
}

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  TEXT: 'Texto',
  NUMBER: 'Número',
  BOOLEAN: 'Sim / Não',
  LIST: 'Lista de opções',
  DATE: 'Data',
}

export const OPERATOR_LABEL: Record<FilterOperator, string> = {
  EQUALS: 'é igual a',
  NOT_EQUALS: 'é diferente de',
  CONTAINS: 'contém',
  STARTS_WITH: 'começa com',
  IN: 'é um de',
  GT: 'maior que',
  GTE: 'maior ou igual a',
  LT: 'menor que',
  LTE: 'menor ou igual a',
  BETWEEN: 'entre',
  IS_EMPTY: 'está vazio',
  NOT_EMPTY: 'está preenchido',
}

/** Colunas da tabela nativa `clients`, como usadas em allowedColumns/hiddenFields */
export const MULHER_COLUMNS = [
  { column: 'nome', field: 'nome', label: 'Nome' },
  { column: 'data_nascimento', field: 'dataNascimento', label: 'Data de nascimento' },
  { column: 'telefone', field: 'telefone', label: 'Telefone' },
  { column: 'sob_risco', field: 'sobRisco', label: 'Situação de risco' },
] as const

export type MulherColumn = (typeof MULHER_COLUMNS)[number]['column']

export function columnLabel(column: string): string {
  return MULHER_COLUMNS.find((c) => c.column === column || c.field === column)?.label ?? column
}
