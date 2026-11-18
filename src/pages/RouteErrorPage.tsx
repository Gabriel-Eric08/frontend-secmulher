import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Bug, Home, RotateCw } from 'lucide-react'
import { ApiError } from '@/api'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ForbiddenState } from '@/components/ui/States'
import { StatusScreen } from '@/components/ui/StatusScreen'
import { NotFoundPage } from './NotFoundPage'

/**
 * Erro inesperado ao renderizar uma rota (errorElement). Mantém o layout quando
 * o erro acontece dentro dele, e mostra 404/403 com as telas próprias.
 */
export function RouteErrorPage({ fullScreen }: { fullScreen?: boolean }) {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return wrap(<NotFoundPage />, fullScreen)
  if (error instanceof ApiError && error.isForbidden) return wrap(<ForbiddenState message={error.detail} />, fullScreen)

  const detail = error instanceof Error ? error.message : isRouteErrorResponse(error) ? error.statusText : undefined
  return wrap(
    <StatusScreen
      tone="danger"
      icon={<Bug />}
      code="ERRO"
      title="Algo deu errado nesta tela"
      description="Um erro inesperado impediu a exibição. Recarregar costuma resolver; se persistir, avise a equipe técnica."
      actions={
        <>
          <Button variant="secondary" icon={<RotateCw className="size-4" />} onClick={() => window.location.reload()}>
            Recarregar
          </Button>
          <ButtonLink to="/" icon={<Home className="size-4" />} reloadDocument>
            Ir para o painel
          </ButtonLink>
        </>
      }
    >
      {detail && import.meta.env.DEV && (
        <pre className="mt-5 max-w-xl overflow-x-auto rounded-lg bg-ink-100 px-4 py-3 text-left font-mono text-xs text-red-700">
          {detail}
        </pre>
      )}
    </StatusScreen>,
    fullScreen,
  )
}

function wrap(node: React.ReactNode, fullScreen?: boolean) {
  return fullScreen ? <div className="flex min-h-screen items-center justify-center bg-ink-50">{node}</div> : node
}
