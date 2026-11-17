import type { RecordKind, SearchRequest, UUID } from '@/api'

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
}
