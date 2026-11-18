import type { CommitmentFilters, OperationFilters, PeriodFilter, RecordKind, SearchRequest, TripFilters, UUID } from '@/api'

/** Chaves centralizadas do React Query: facilita invalidação consistente. */
export const qk = {
  me: ['me'] as const,

  users: {
    all: ['users'] as const,
    detail: (id: UUID) => ['users', id] as const,
    activities: (id: UUID) => ['users', id, 'activities'] as const,
  },

  categories: {
    all: ['categories'] as const,
    detail: (id: UUID) => ['categories', id] as const,
    fields: (categoryId: UUID) => ['categories', categoryId, 'fields'] as const,
    activityTypes: (categoryId: UUID, includeInactive = false) =>
      ['categories', categoryId, 'activity-types', { includeInactive }] as const,
    activityTypesAll: (categoryId: UUID) => ['categories', categoryId, 'activity-types'] as const,
  },

  permissions: {
    all: ['permissions'] as const,
    byUser: (userId?: UUID) => ['permissions', { userId }] as const,
  },

  mulheres: {
    all: ['mulheres'] as const,
    detail: (id: UUID) => ['mulheres', id] as const,
  },

  entities: {
    all: ['entities'] as const,
    byCategory: (categoryId?: UUID) => ['entities', 'list', { categoryId }] as const,
    search: (req: SearchRequest) => ['entities', 'search', req] as const,
    detail: (id: UUID) => ['entities', id] as const,
  },

  record: {
    root: (kind: RecordKind, id: UUID) => ['record', kind, id] as const,
    overview: (kind: RecordKind, id: UUID) => ['record', kind, id, 'overview'] as const,
    activities: (kind: RecordKind, id: UUID) => ['record', kind, id, 'activities'] as const,
    files: (kind: RecordKind, id: UUID) => ['record', kind, id, 'files'] as const,
  },

  /** Tudo do financeiro fica sob ['finance']: uma operação muda saldos em várias telas. */
  finance: {
    all: ['finance'] as const,
    dashboard: (date?: string) => ['finance', 'dashboard', { date }] as const,
    action: (id: UUID, date?: string) => ['finance', 'action', id, { date }] as const,
    actionHistory: (id: UUID, period?: PeriodFilter) => ['finance', 'action', id, 'history', period ?? {}] as const,
    subAction: (id: UUID, date?: string) => ['finance', 'sub-action', id, { date }] as const,
    subActionHistory: (id: UUID, period?: PeriodFilter) =>
      ['finance', 'sub-action', id, 'history', period ?? {}] as const,
    operations: (filters?: OperationFilters) => ['finance', 'operations', filters ?? {}] as const,
    commitments: (filters?: CommitmentFilters) => ['finance', 'commitments', filters ?? {}] as const,
    commitment: (id: UUID) => ['finance', 'commitment', id] as const,
  },

  /** Tudo de frotas sob ['fleet']: agendar/iniciar/concluir muda agenda, disponibilidade e odômetro. */
  fleet: {
    all: ['fleet'] as const,
    drivers: ['fleet', 'drivers'] as const,
    driver: (id: UUID) => ['fleet', 'drivers', id] as const,
    vehicles: ['fleet', 'vehicles'] as const,
    vehicle: (id: UUID) => ['fleet', 'vehicles', id] as const,
    trips: (filters?: TripFilters) => ['fleet', 'trips', filters ?? {}] as const,
    mine: (period?: { from?: string; to?: string }) => ['fleet', 'mine', period ?? {}] as const,
    trip: (id: UUID) => ['fleet', 'trip', id] as const,
    availability: (start: string, end: string) => ['fleet', 'availability', start, end] as const,
  },
}
