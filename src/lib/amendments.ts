import type {
  Amendment,
  AmendmentActivityKind,
  AmendmentDateField,
  AmendmentSort,
  AmendmentStatus,
  AmendmentTextField,
  DeadlineStatus,
  PendencyKind,
} from '@/api'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

// ---------------------------------------------------------------- Situação

export const AMENDMENT_STATUSES: AmendmentStatus[] = ['IN_PROGRESS', 'WAITING', 'BLOCKED', 'COMPLETED', 'CANCELLED']

export const AMENDMENT_STATUS_LABEL: Record<AmendmentStatus, string> = {
  IN_PROGRESS: 'Em andamento',
  WAITING: 'Aguardando',
  BLOCKED: 'Com impedimento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
}

export const AMENDMENT_STATUS_TONE: Record<AmendmentStatus, Tone> = {
  IN_PROGRESS: 'brand',
  WAITING: 'warning',
  BLOCKED: 'danger',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

export const isClosed = (s: AmendmentStatus) => s === 'COMPLETED' || s === 'CANCELLED'

export const PENDENCY_KIND_LABEL: Record<PendencyKind, string> = {
  IMPEDIMENT: 'Impedimento',
  WAITING: 'Aguardando',
}

export const PENDENCY_KIND_TONE: Record<PendencyKind, Tone> = {
  IMPEDIMENT: 'danger',
  WAITING: 'warning',
}

export const ACTIVITY_KIND_TONE: Record<AmendmentActivityKind, Tone> = {
  CREATED: 'brand',
  FIELD_UPDATE: 'neutral',
  NOTE: 'brand',
  PENDENCY_OPENED: 'warning',
  PENDENCY_RESOLVED: 'success',
  COMPLETED: 'success',
  REOPENED: 'brand',
  CANCELLED: 'neutral',
  IMPORTED: 'neutral',
}

export const SORT_LABEL: Record<AmendmentSort, string> = {
  RECENT: 'Atividade mais recente',
  IDLE: 'Parada há mais tempo',
  DEADLINE: 'Vigência mais próxima',
  OLDEST_PENDENCY: 'Pendência mais antiga',
  AMOUNT: 'Maior valor',
  PARLIAMENTARIAN: 'Parlamentar (A–Z)',
}

// ---------------------------------------------------------------- Prazo (vigência do TF)

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

/** Rótulo e tom do prazo da vigência do Termo de Fomento. */
export function deadlineInfo(a: Pick<Amendment, 'deadlineStatus' | 'daysToDeadline'>): { tone: Tone; label: string } | null {
  const d = a.daysToDeadline
  switch (a.deadlineStatus as DeadlineStatus) {
    case 'NO_TERM':
    case 'CLOSED':
      return null
    case 'EXPIRED':
      return { tone: 'danger', label: d != null ? `Vencida há ${plural(-d, 'dia', 'dias')}` : 'Vigência vencida' }
    case 'NEAR':
      return { tone: 'warning', label: d === 0 ? 'Vence hoje' : `Vence em ${plural(d ?? 0, 'dia', 'dias')}` }
    case 'OK':
      return { tone: 'neutral', label: d != null ? `${plural(d, 'dia', 'dias')} de vigência` : 'No prazo' }
  }
}

/** "parada há 12 dias" / "atividade hoje" */
export function idleLabel(days: number | null | undefined): string {
  if (days == null) return '—'
  if (days === 0) return 'Atividade hoje'
  return `Parada há ${plural(days, 'dia', 'dias')}`
}

export const daysLabel = (days: number | null | undefined) => (days == null ? '—' : plural(days, 'dia', 'dias'))

// ---------------------------------------------------------------- Campos da planilha

export type FieldKind = 'text' | 'textarea' | 'date'

export interface SheetField {
  key: AmendmentTextField | AmendmentDateField
  label: string
  /** Cabeçalho na planilha de emendas */
  sheet: string
  kind: FieldKind
  max?: number
  /** Ocupa a linha inteira no formulário/ficha */
  wide?: boolean
}

const t = (key: AmendmentTextField, label: string, sheet: string, max: number, wide = false): SheetField => ({
  key,
  label,
  sheet,
  kind: 'text',
  max,
  wide,
})
const area = (key: AmendmentTextField, label: string, sheet: string): SheetField => ({
  key,
  label,
  sheet,
  kind: 'textarea',
  max: 10000,
  wide: true,
})
const date = (key: AmendmentDateField, label: string, sheet: string): SheetField => ({ key, label, sheet, kind: 'date' })

/**
 * Seções da ficha e do formulário. Ano, parlamentar, valor, setor e técnica responsável
 * têm controles próprios e são tratados à parte (ver `special`).
 */
export interface SheetSection {
  id: string
  title: string
  description?: string
  special?: ('exerciseYear' | 'parliamentarian' | 'currentAmount' | 'sector' | 'responsible')[]
  fields: SheetField[]
}

export const SHEET_SECTIONS: SheetSection[] = [
  {
    id: 'identificacao',
    title: 'Identificação',
    special: ['exerciseYear', 'parliamentarian'],
    fields: [
      t('cycle', 'Ciclo', 'CICLO', 50),
      t('code', 'Código', 'COD', 50),
      t('alepeCode', 'Código ALEPE', 'COD ALEPE', 50),
      t('category', 'Categoria', 'CATEGORIA', 100),
      t('type', 'Tipo', 'TIPO', 100),
    ],
  },
  {
    id: 'orcamento',
    title: 'Classificação orçamentária',
    special: ['currentAmount'],
    fields: [
      t('actionCode', 'Código da ação', 'AÇÃO_COD', 50),
      t('actionName', 'Nome da ação', 'AÇÃO_NOME', 255),
      t('subAction', 'Subação', 'SUBAÇÃO', 255),
      t('expenseGroup', 'Grupo de despesa (GD)', 'GD', 20),
      t('applicationModality', 'Modalidade (MOD)', 'MOD', 20),
    ],
  },
  {
    id: 'beneficiario',
    title: 'Beneficiário e objeto',
    fields: [
      t('beneficiary', 'Beneficiário', 'BENEFICIÁRIO', 255),
      t('municipality', 'Município', 'MUNICÍPIO', 150),
      area('object', 'Objeto', 'OBJETO'),
      area('details', 'Detalhamento', 'DETALHAMENTO'),
    ],
  },
  {
    id: 'planilha',
    title: 'Situação na planilha',
    description: 'Texto livre, como veio da planilha. A situação usada nos filtros é a do sistema.',
    fields: [
      t('situation', 'Situação', 'SITUAÇÃO', 255),
      t('financialStatus', 'Status financeiro', 'STATUS FINANCEIRO', 255),
      t('documentalStatus', 'Status documental/físico', 'STATUS DOCUMENTAL/ FÍSICO', 255),
      t('underChange', 'Em alteração', 'EM ALTERAÇÃO', 255),
      area('seplagImpediment', 'Impedimento técnico (SEPLAG)', 'IMPEDIMENTO TÉCNICO - SEPLAG'),
      area('notes', 'Observações', 'OBSERVAÇÕES'),
    ],
  },
  {
    id: 'responsavel',
    title: 'Responsável e parecer',
    special: ['sector', 'responsible'],
    fields: [
      t('technicalArea', 'Área técnica', 'ÁREA TÉCNICA', 255),
      t('seiNumber', 'Nº SEI', 'Nº SEI', 50),
      area('technicalOpinion', 'Parecer técnico', 'PARECER TÉCNICO'),
    ],
  },
  {
    id: 'termo',
    title: 'Termo de Fomento e GTV',
    description: 'A vigência do Termo de Fomento é o prazo limite para concluir a emenda.',
    fields: [
      t('termNumber', 'Nº Termo de Fomento', 'Nº TERMO FOMENTO (TF)', 50),
      date('termEndDate', 'Vigência do TF', 'VIGÊNCIA (TF)'),
      t('callNumber', 'Nº chamamento (DP)', 'Nº CHAMAMENTO (DP)', 50),
      t('proposalNumber', 'Nº proposta', 'Nº PROPOSTA', 50),
    ],
  },
  {
    id: 'execucao',
    title: 'Execução financeira',
    fields: [
      t('pfNumber', 'PF nº', 'PF Nº', 50),
      date('pfDate', 'Data da PF', 'DATA PF'),
      t('sefazPf', 'SEFAZ PF (data/aut.)', 'SEFAZ_PF (DT./ AUT.)', 100),
      t('commitmentNumber', 'Nº empenho', 'Nº EMPENHO', 50),
      t('dhNumber', 'DH', 'DH', 50),
      t('leNumber', 'LE', 'LE', 50),
      t('pd', 'PD (nº/data)', 'PD (Nº/ DT)', 100),
      t('obNumber', 'Nº OB', 'Nº OB', 50),
      date('paymentDate', 'Data do pagamento', 'DATA PAGTO'),
    ],
  },
]

export const ALL_SHEET_FIELDS = SHEET_SECTIONS.flatMap((s) => s.fields)

/** Rótulo de um campo nas alterações da linha do tempo (chaves camelCase do backend). */
const EXTRA_LABELS: Record<string, string> = {
  exerciseYear: 'Ano (LOA)',
  parliamentarian: 'Parlamentar',
  currentAmount: 'Valor atual',
  sector: 'Setor',
  responsibleUser: 'Técnica (usuária)',
  responsibleName: 'Técnica responsável',
  status: 'Situação',
}

export function amendmentFieldLabel(key: string): string {
  return EXTRA_LABELS[key] ?? ALL_SHEET_FIELDS.find((f) => f.key === key)?.label ?? key
}

/** Título curto da emenda: "COD · Parlamentar" */
export function amendmentTitle(a: Pick<Amendment, 'code' | 'parliamentarian'>): string {
  return a.code ? `${a.code} · ${a.parliamentarian}` : a.parliamentarian
}

export const responsibleOf = (a: Pick<Amendment, 'responsibleName' | 'responsibleUser'>) =>
  a.responsibleName || a.responsibleUser?.name || null
