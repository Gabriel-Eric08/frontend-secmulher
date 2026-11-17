import type { ActivityTypeSummary, UUID } from '@/api'
import { useActivityTypes, useCategories } from '@/queries/admin'
import { useAuth } from './AuthContext'
import { MULHERES_TABLE } from './access'

/**
 * Tipos de registro manual que a usuária pode registrar numa categoria.
 * Usuária comum: vêm prontos em /auth/me (já filtrados pela permissão).
 * Administradora: /auth/me não lista categorias, então busca os tipos ativos da categoria.
 */
export function useRegistrableTypes(categoryId: UUID | undefined) {
  const { isAdmin, access } = useAuth()
  const fromMe = access.find((a) => a.categoryId === categoryId)?.activityTypes
  const needsFetch = !!categoryId && (isAdmin || fromMe === undefined)
  const query = useActivityTypes(categoryId, { enabled: needsFetch })

  const types: ActivityTypeSummary[] = needsFetch ? (query.data ?? []) : (fromMe ?? [])
  return { types, isLoading: needsFetch && query.isPending, error: needsFetch ? query.error : null }
}

/** Id da categoria nativa das mulheres atendidas (tableReference "clients"). */
export function useMulheresCategoryId(): UUID | undefined {
  const { access } = useAuth()
  const categories = useCategories()
  const fromMe = access.find((a) => a.entityType === 'native' && a.tableReference === MULHERES_TABLE)
  if (fromMe) return fromMe.categoryId
  return categories.data
    ?.filter((c) => c.entityType === 'native' && c.tableReference === MULHERES_TABLE)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.id
}
