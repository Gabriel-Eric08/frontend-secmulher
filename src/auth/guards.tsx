import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LogOut, RotateCw, ServerCrash } from 'lucide-react'
import { errorMessage } from '@/api'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { ForbiddenState } from '@/components/ui/States'
import { StatusScreen } from '@/components/ui/StatusScreen'
import { Button } from '@/components/ui/Button'
import { useAuth } from './AuthContext'

export function RequireAuth() {
  const { status, sessionError, refresh, logout } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />
  // Há sessão, mas o servidor não respondeu: explica em vez de voltar ao login em silêncio
  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <StatusScreen
          tone="danger"
          icon={<ServerCrash />}
          title="Não foi possível carregar sua sessão"
          description={errorMessage(sessionError)}
          actions={
            <>
              <Button variant="secondary" icon={<LogOut className="size-4" />} onClick={logout}>
                Sair
              </Button>
              <Button icon={<RotateCw className="size-4" />} onClick={() => refresh()}>
                Tentar novamente
              </Button>
            </>
          }
        />
      </div>
    )
  }
  return <Outlet />
}

export function RequireAdmin() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <ForbiddenState message="Esta área é restrita à administração." />
  return <Outlet />
}
