import { Navigate, useParams } from 'react-router-dom'
import { useEntity } from '@/queries/records'
import { ErrorState } from '@/components/ui/States'
import { PageSkeleton } from '@/components/ui/Spinner'

/** /registros/:id → /cadastros/:categoryId/:id (links da auditoria só têm o id da entidade). */
export function RegistroRedirect() {
  const { id } = useParams()
  const entity = useEntity(id)
  if (entity.isPending) return <PageSkeleton />
  if (entity.isError) return <ErrorState error={entity.error} />
  return <Navigate to={`/cadastros/${entity.data.categoryId}/${entity.data.id}`} replace />
}
