import type { CategoryAccess, ConfidentialityLevel, UUID } from '@/api'

export const CONFIDENTIALITY_ORDER: ConfidentialityLevel[] = ['INTERNAL', 'RESTRICTED', 'CONFIDENTIAL']

export const levelRank = (l: ConfidentialityLevel) => CONFIDENTIALITY_ORDER.indexOf(l)

/** Tabela nativa das mulheres atendidas no backend. */
export const MULHERES_TABLE = 'clients'

/** Tabela nativa do módulo financeiro: a permissão nessa categoria vale para todo o financeiro. */
export const FINANCE_TABLE = 'finance_actions'

/** Tabela nativa do módulo de frotas: a permissão nessa categoria vale para todo o módulo. */
export const FLEET_TABLE = 'fleet_trips'

/**
 * Acesso efetivo do usuário a uma categoria. É só para a interface (esconder botões,
 * desabilitar campos): a autorização de verdade é sempre do backend.
 */
export interface Access {
  isAdmin: boolean
  canRead: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  maxConfidentiality: ConfidentialityLevel
  canReadColumn: (column: string) => boolean
  canWriteColumn: (column: string) => boolean
  canAccessLevel: (level: ConfidentialityLevel) => boolean
  /** Níveis de sigilo que o usuário pode usar (upload/alteração) */
  allowedLevels: ConfidentialityLevel[]
}

export const FULL_ACCESS: Access = {
  isAdmin: true,
  canRead: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  maxConfidentiality: 'CONFIDENTIAL',
  canReadColumn: () => true,
  canWriteColumn: () => true,
  canAccessLevel: () => true,
  allowedLevels: CONFIDENTIALITY_ORDER,
}

export const NO_ACCESS: Access = {
  isAdmin: false,
  canRead: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  maxConfidentiality: 'INTERNAL',
  canReadColumn: () => false,
  canWriteColumn: () => false,
  canAccessLevel: () => false,
  allowedLevels: [],
}

export function accessFromCategory(ca: CategoryAccess | undefined): Access {
  if (!ca) return NO_ACCESS
  const read = ca.allowedColumns?.read
  const write = ca.allowedColumns?.write
  const max = levelRank(ca.maxConfidentiality ?? 'INTERNAL')
  return {
    isAdmin: false,
    canRead: ca.canRead,
    canCreate: ca.canCreate,
    canUpdate: ca.canUpdate,
    canDelete: ca.canDelete,
    maxConfidentiality: ca.maxConfidentiality,
    canReadColumn: (c) => ca.canRead && (!read || read.includes(c)),
    canWriteColumn: (c) => !write || write.includes(c),
    canAccessLevel: (l) => levelRank(l) <= max,
    allowedLevels: CONFIDENTIALITY_ORDER.filter((l) => levelRank(l) <= max),
  }
}

export function resolveAccess(
  isAdmin: boolean,
  access: CategoryAccess[],
  by: { categoryId?: UUID; tableReference?: string },
): Access {
  if (isAdmin) return FULL_ACCESS
  const ca = access.find(
    (a) =>
      (by.categoryId && a.categoryId === by.categoryId) ||
      (by.tableReference && a.entityType === 'native' && a.tableReference === by.tableReference),
  )
  return accessFromCategory(ca)
}
