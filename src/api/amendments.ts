import { http } from './http'
import type { ISODate, UUID } from './types'
import type { LocalDateTime } from './fleet'

/**
 * Módulo de emendas parlamentares (planilha da LOA).
 * Datas "AAAA-MM-DD"; datas e horas são LocalDateTime sem fuso: "AAAA-MM-DDTHH:MM[:SS]".
 */

export type AmendmentStatus = 'IN_PROGRESS' | 'WAITING' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED'
export type PendencyKind = 'IMPEDIMENT' | 'WAITING'
export type AmendmentActivityKind =
  | 'CREATED'
  | 'FIELD_UPDATE'
  | 'NOTE'
  | 'PENDENCY_OPENED'
  | 'PENDENCY_RESOLVED'
  | 'COMPLETED'
  | 'REOPENED'
  | 'CANCELLED'
  | 'IMPORTED'
export type DeadlineStatus = 'NO_TERM' | 'OK' | 'NEAR' | 'EXPIRED' | 'CLOSED'
export type AmendmentSort = 'RECENT' | 'IDLE' | 'DEADLINE' | 'OLDEST_PENDENCY' | 'AMOUNT' | 'PARLIAMENTARIAN'

export interface NamedRef {
  id: UUID
  name: string
}

// ---------------------------------------------------------------- Setores

export interface AmendmentSector {
  id: UUID
  name: string
  description: string | null
  isActive: boolean
  createdAt: LocalDateTime
  updatedAt: LocalDateTime
}

export interface AmendmentSectorRequest {
  name: string
  description?: string
  isActive?: boolean
}

// ---------------------------------------------------------------- Emendas

/** Campos da planilha que são texto (todos opcionais, exceto parlamentar). */
export interface AmendmentSheetText {
  cycle: string | null
  parliamentarian: string
  category: string | null
  alepeCode: string | null
  code: string | null
  actionCode: string | null
  actionName: string | null
  subAction: string | null
  expenseGroup: string | null
  applicationModality: string | null
  beneficiary: string | null
  municipality: string | null
  object: string | null
  type: string | null
  underChange: string | null
  financialStatus: string | null
  seplagImpediment: string | null
  documentalStatus: string | null
  details: string | null
  notes: string | null
  technicalArea: string | null
  responsibleName: string | null
  seiNumber: string | null
  technicalOpinion: string | null
  termNumber: string | null
  pfNumber: string | null
  sefazPf: string | null
  commitmentNumber: string | null
  dhNumber: string | null
  leNumber: string | null
  pd: string | null
  obNumber: string | null
  callNumber: string | null
  proposalNumber: string | null
  situation: string | null
}

export interface AmendmentSheetDates {
  termEndDate: ISODate | null
  pfDate: ISODate | null
  paymentDate: ISODate | null
}

export interface Amendment extends AmendmentSheetText, AmendmentSheetDates {
  id: UUID
  exerciseYear: number
  currentAmount: number | null
  sector: NamedRef | null
  responsibleUser: NamedRef | null
  // Controle do sistema
  status: AmendmentStatus
  statusLabel: string
  lastActivityAt: LocalDateTime
  /** Dias desde a última atividade */
  idleDays: number | null
  /** Dias até o fim da vigência do TF (negativo = vencida) */
  daysToDeadline: number | null
  deadlineStatus: DeadlineStatus
  openPendencies: number
  oldestOpenPendencyAt: LocalDateTime | null
  completedAt: LocalDateTime | null
  completedBy: NamedRef | null
  cancelledAt: LocalDateTime | null
  cancelledBy: NamedRef | null
  createdBy: UUID | null
  createdAt: LocalDateTime
  updatedAt: LocalDateTime
}

export type AmendmentTextField = keyof AmendmentSheetText
export type AmendmentDateField = keyof AmendmentSheetDates

/** POST/PUT: no PUT o corpo substitui tudo (campo ausente = vazio). */
export type AmendmentRequest = Partial<Record<AmendmentTextField, string>> &
  Partial<Record<AmendmentDateField, ISODate>> & {
    exerciseYear: number
    parliamentarian: string
    currentAmount?: number | null
    sectorId?: UUID | null
    responsibleUserId?: UUID | null
    /** Só no PUT: texto que acompanha a alteração na linha do tempo */
    comment?: string
  }

export interface AmendmentFilters {
  status?: AmendmentStatus[]
  open?: boolean
  pending?: boolean
  pendencyKind?: PendencyKind
  idleDays?: number
  deadlineWithinDays?: number
  expired?: boolean
  sectorId?: UUID
  responsibleUserId?: UUID
  mine?: boolean
  exerciseYear?: number
  cycle?: string
  parliamentarian?: string
  municipality?: string
  q?: string
  sort?: AmendmentSort
}

export interface AmendmentSummaryFilters {
  exerciseYear?: number
  sectorId?: UUID
  responsibleUserId?: UUID
  mine?: boolean
  idleDays?: number
}

export interface AmendmentSummary {
  total: number
  byStatus: Partial<Record<AmendmentStatus, number>>
  open: number
  pending: number
  expired: number
  nearDeadline: number
  deadlineAlertDays: number
  idle: number
  idleDays: number
}

export interface AmendmentOptions {
  exerciseYears: number[]
  cycles: string[]
  parliamentarians: string[]
  municipalities: string[]
  categories: string[]
  types: string[]
  technicalAreas: string[]
}

// ---------------------------------------------------------------- Acompanhamento

export interface AmendmentPendency {
  id: UUID
  amendmentId: UUID
  kind: PendencyKind
  kindLabel: string
  description: string
  waitingOn: string | null
  open: boolean
  openedAt: LocalDateTime
  openedBy: NamedRef | null
  resolvedAt: LocalDateTime | null
  resolvedBy: NamedRef | null
  resolution: string | null
  daysOpen: number | null
}

export interface AmendmentActivity {
  id: UUID
  amendmentId: UUID
  kind: AmendmentActivityKind
  kindLabel: string
  description: string | null
  /** {"campo": {"antigo": ..., "novo": ...}} */
  changes: Record<string, unknown> | null
  pendencyId: UUID | null
  user: NamedRef | null
  occurredAt: LocalDateTime
  createdAt: LocalDateTime
}

export interface NoteRequest {
  description: string
  occurredAt?: LocalDateTime
}

export interface PendencyRequest {
  kind: PendencyKind
  description: string
  waitingOn?: string
  openedAt?: LocalDateTime
}

export interface ResolvePendencyRequest {
  resolution: string
  resolvedAt?: LocalDateTime
}

export interface CompleteAmendmentRequest {
  description?: string
  completedAt?: LocalDateTime
}

function clean<T extends object>(params: T | undefined): Partial<T> | undefined {
  if (!params) return undefined
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0),
    ),
  ) as Partial<T>
}

/** status=WAITING&status=BLOCKED (sem colchetes), como o Spring espera */
const repeatArrays = { indexes: null }

export const amendmentsApi = {
  sectors: {
    list: () => http.get<AmendmentSector[]>('/amendments/sectors').then((r) => r.data),
    get: (id: UUID) => http.get<AmendmentSector>(`/amendments/sectors/${id}`).then((r) => r.data),
    create: (body: AmendmentSectorRequest) => http.post<AmendmentSector>('/amendments/sectors', body).then((r) => r.data),
    update: (id: UUID, body: AmendmentSectorRequest) =>
      http.put<AmendmentSector>(`/amendments/sectors/${id}`, body).then((r) => r.data),
    remove: (id: UUID) => http.delete<void>(`/amendments/sectors/${id}`).then(() => undefined),
  },
  list: (filters?: AmendmentFilters) =>
    http
      .get<Amendment[]>('/amendments', { params: clean(filters), paramsSerializer: repeatArrays })
      .then((r) => r.data),
  summary: (filters?: AmendmentSummaryFilters) =>
    http.get<AmendmentSummary>('/amendments/summary', { params: clean(filters) }).then((r) => r.data),
  options: () => http.get<AmendmentOptions>('/amendments/options').then((r) => r.data),
  get: (id: UUID) => http.get<Amendment>(`/amendments/${id}`).then((r) => r.data),
  create: (body: AmendmentRequest) => http.post<Amendment>('/amendments', body).then((r) => r.data),
  update: (id: UUID, body: AmendmentRequest) => http.put<Amendment>(`/amendments/${id}`, body).then((r) => r.data),
  remove: (id: UUID) => http.delete<void>(`/amendments/${id}`).then(() => undefined),
  timeline: (id: UUID) => http.get<AmendmentActivity[]>(`/amendments/${id}/timeline`).then((r) => r.data),
  pendencies: (id: UUID, open?: boolean) =>
    http.get<AmendmentPendency[]>(`/amendments/${id}/pendencies`, { params: clean({ open }) }).then((r) => r.data),
  addNote: (id: UUID, body: NoteRequest) => http.post<Amendment>(`/amendments/${id}/notes`, body).then((r) => r.data),
  openPendency: (id: UUID, body: PendencyRequest) =>
    http.post<AmendmentPendency>(`/amendments/${id}/pendencies`, body).then((r) => r.data),
  resolvePendency: (id: UUID, pendencyId: UUID, body: ResolvePendencyRequest) =>
    http.post<AmendmentPendency>(`/amendments/${id}/pendencies/${pendencyId}/resolve`, body).then((r) => r.data),
  complete: (id: UUID, body: CompleteAmendmentRequest) =>
    http.post<Amendment>(`/amendments/${id}/complete`, body).then((r) => r.data),
  cancel: (id: UUID, reason: string) => http.post<Amendment>(`/amendments/${id}/cancel`, { reason }).then((r) => r.data),
  reopen: (id: UUID, reason: string) => http.post<Amendment>(`/amendments/${id}/reopen`, { reason }).then((r) => r.data),
}
