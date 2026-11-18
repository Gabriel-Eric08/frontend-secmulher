import { http } from './http'
import type { ISODate, ISODateTime, UUID } from './types'

/**
 * Módulo financeiro (ações, subações, operações e execução da despesa).
 * Valores monetários chegam como número JSON (BigDecimal no backend).
 */

// ---------------------------------------------------------------- Enums

export type FinanceOperationMethod =
  | 'OPENING'
  | 'DISTRIBUTION'
  | 'TRANSFER_BETWEEN_SUB_ACTIONS'
  | 'TRANSFER_BETWEEN_ACTIONS'
  | 'TAC'
  | 'COMMITMENT'
  | 'COMMITMENT_CANCELLATION'
  | 'LIQUIDATION'
  | 'PAYMENT'

export type FinanceEntryKind = 'BUDGET' | 'COMMITTED' | 'LIQUIDATED' | 'PAID'

export type CommitmentStatus = 'TO_LIQUIDATE' | 'TO_PAY' | 'PAID' | 'CANCELLED'

// ---------------------------------------------------------------- Respostas

export interface FinanceSubAction {
  id: UUID
  actionId: UUID
  actionCode: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  /** Dotação atual */
  balance: number
  committedAmount: number
  liquidatedAmount: number
  paidAmount: number
  /** Dotação − empenhado */
  availableAmount: number
  createdBy: UUID | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface FinanceAction {
  id: UUID
  code: string
  name: string
  description: string | null
  isActive: boolean
  totalAmount: number
  distributedAmount: number
  undistributedAmount: number
  committedAmount: number
  liquidatedAmount: number
  paidAmount: number
  availableAmount: number
  createdBy: UUID | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
  subActions: FinanceSubAction[]
}

export interface FinanceTotals {
  totalAmount: number
  distributedAmount: number
  undistributedAmount: number
  committedAmount: number
  liquidatedAmount: number
  paidAmount: number
  availableAmount: number
}

export interface FinanceDashboard extends FinanceTotals {
  date: ISODate | null
  actions: FinanceAction[]
}

export interface FinanceEntry {
  actionId: UUID
  actionCode: string
  actionName: string
  subActionId: UUID | null
  subActionCode: string | null
  subActionName: string | null
  kind: FinanceEntryKind
  /** Com sinal: positivo entra, negativo sai */
  amount: number
}

export interface FinanceOperation {
  id: UUID
  number: number
  method: FinanceOperationMethod
  methodLabel: string
  amount: number
  description: string | null
  commitmentId: UUID | null
  commitmentNumber: string | null
  performedBy: UUID | null
  performedByName: string | null
  /** Data real da operação */
  operationDate: ISODate
  /** Momento do registro no sistema */
  registeredAt: ISODateTime
  entries: FinanceEntry[]
}

export interface ActionHistoryItem {
  operation: FinanceOperation
  totalDelta: number
  totalAfter: number
  undistributedDelta: number
  undistributedAfter: number
  committedDelta: number
  committedAfter: number
  liquidatedDelta: number
  liquidatedAfter: number
  paidDelta: number
  paidAfter: number
  availableAfter: number
}

export interface SubActionHistoryItem {
  operation: FinanceOperation
  /** Variação da dotação */
  delta: number
  balanceAfter: number
  committedDelta: number
  committedAfter: number
  liquidatedDelta: number
  liquidatedAfter: number
  paidDelta: number
  paidAfter: number
  availableAfter: number
}

export interface Commitment {
  id: UUID
  number: string
  commitmentDate: ISODate
  actionId: UUID
  actionCode: string
  subActionId: UUID
  subActionCode: string
  creditor: string
  description: string | null
  amount: number
  cancelledAmount: number
  committedAmount: number
  liquidatedAmount: number
  paidAmount: number
  toLiquidateAmount: number
  toPayAmount: number
  status: CommitmentStatus
  createdBy: UUID | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface CommitmentDetail {
  commitment: Commitment
  operations: FinanceOperation[]
}

// ---------------------------------------------------------------- Requisições

export interface FinanceActionCreateRequest {
  code: string
  name: string
  description?: string
  initialAmount?: number
  initialDate?: ISODate
}

export interface FinanceActionUpdateRequest {
  code: string
  name: string
  description?: string
  isActive: boolean
}

export interface FinanceSubActionRequest {
  code: string
  name: string
  description?: string
  isActive?: boolean
}

export interface AllocationRequest {
  subActionId: UUID
  amount: number
}

export interface DistributionRequest {
  actionId: UUID
  allocations: AllocationRequest[]
  description?: string
  date?: ISODate
}

export interface TransferRequest {
  fromSubActionId: UUID
  toSubActionId: UUID
  amount: number
  description?: string
  date?: ISODate
}

export interface TacRequest {
  actionId: UUID
  amount: number
  allocations?: AllocationRequest[]
  description?: string
  date?: ISODate
}

export interface CommitmentCreateRequest {
  subActionId: UUID
  number: string
  creditor: string
  description?: string
  amount: number
  date?: ISODate
}

export interface CommitmentUpdateRequest {
  number: string
  creditor: string
  description?: string
}

export interface CommitmentMovementRequest {
  amount: number
  description?: string
  date?: ISODate
}

export type CommitmentMovement = 'liquidations' | 'payments' | 'cancellations'

export interface OperationFilters {
  actionId?: UUID
  subActionId?: UUID
  commitmentId?: UUID
  method?: FinanceOperationMethod
  from?: ISODate
  to?: ISODate
}

export interface CommitmentFilters {
  actionId?: UUID
  subActionId?: UUID
  creditor?: string
  status?: CommitmentStatus
}

export interface PeriodFilter {
  from?: ISODate
  to?: ISODate
}

/** Remove chaves vazias para não mandar `?x=` na URL. */
function clean<T extends object>(params: T | undefined): Partial<T> | undefined {
  if (!params) return undefined
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>
}

const asOf = (date?: ISODate) => (date ? { date } : undefined)

// ---------------------------------------------------------------- Rotas

export const financeApi = {
  dashboard: (date?: ISODate) =>
    http.get<FinanceDashboard>('/finance/dashboard', { params: asOf(date) }).then((r) => r.data),

  actions: {
    list: (date?: ISODate) => http.get<FinanceAction[]>('/finance/actions', { params: asOf(date) }).then((r) => r.data),
    get: (id: UUID, date?: ISODate) =>
      http.get<FinanceAction>(`/finance/actions/${id}`, { params: asOf(date) }).then((r) => r.data),
    history: (id: UUID, period?: PeriodFilter) =>
      http.get<ActionHistoryItem[]>(`/finance/actions/${id}/history`, { params: clean(period) }).then((r) => r.data),
    create: (body: FinanceActionCreateRequest) => http.post<FinanceAction>('/finance/actions', body).then((r) => r.data),
    update: (id: UUID, body: FinanceActionUpdateRequest) =>
      http.put<FinanceAction>(`/finance/actions/${id}`, body).then((r) => r.data),
    remove: (id: UUID) => http.delete<void>(`/finance/actions/${id}`).then(() => undefined),
    createSubAction: (actionId: UUID, body: FinanceSubActionRequest) =>
      http.post<FinanceSubAction>(`/finance/actions/${actionId}/sub-actions`, body).then((r) => r.data),
  },

  subActions: {
    get: (id: UUID, date?: ISODate) =>
      http.get<FinanceSubAction>(`/finance/sub-actions/${id}`, { params: asOf(date) }).then((r) => r.data),
    history: (id: UUID, period?: PeriodFilter) =>
      http
        .get<SubActionHistoryItem[]>(`/finance/sub-actions/${id}/history`, { params: clean(period) })
        .then((r) => r.data),
    update: (id: UUID, body: FinanceSubActionRequest) =>
      http.put<FinanceSubAction>(`/finance/sub-actions/${id}`, body).then((r) => r.data),
    remove: (id: UUID) => http.delete<void>(`/finance/sub-actions/${id}`).then(() => undefined),
  },

  operations: {
    list: (filters?: OperationFilters) =>
      http.get<FinanceOperation[]>('/finance/operations', { params: clean(filters) }).then((r) => r.data),
    get: (id: UUID) => http.get<FinanceOperation>(`/finance/operations/${id}`).then((r) => r.data),
    distribute: (body: DistributionRequest) =>
      http.post<FinanceOperation>('/finance/operations/distributions', body).then((r) => r.data),
    transferBetweenSubActions: (body: TransferRequest) =>
      http.post<FinanceOperation>('/finance/operations/sub-action-transfers', body).then((r) => r.data),
    transferBetweenActions: (body: TransferRequest) =>
      http.post<FinanceOperation>('/finance/operations/action-transfers', body).then((r) => r.data),
    tac: (body: TacRequest) => http.post<FinanceOperation>('/finance/operations/tac', body).then((r) => r.data),
  },

  commitments: {
    list: (filters?: CommitmentFilters) =>
      http.get<Commitment[]>('/finance/commitments', { params: clean(filters) }).then((r) => r.data),
    get: (id: UUID) => http.get<CommitmentDetail>(`/finance/commitments/${id}`).then((r) => r.data),
    create: (body: CommitmentCreateRequest) =>
      http.post<CommitmentDetail>('/finance/commitments', body).then((r) => r.data),
    update: (id: UUID, body: CommitmentUpdateRequest) =>
      http.put<Commitment>(`/finance/commitments/${id}`, body).then((r) => r.data),
    move: (id: UUID, movement: CommitmentMovement, body: CommitmentMovementRequest) =>
      http.post<CommitmentDetail>(`/finance/commitments/${id}/${movement}`, body).then((r) => r.data),
  },
}
