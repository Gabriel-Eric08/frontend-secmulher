import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, ShieldOff } from 'lucide-react'
import { ApiError, errorMessage } from '@/api'
import { Button } from './Button'

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <p className="font-medium text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof ApiError && error.isForbidden) return <ForbiddenState message={error.detail} />
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="size-5" />
      </div>
      <p className="font-medium text-ink-800">Não foi possível carregar</p>
      <p className="mt-1 max-w-sm text-sm text-ink-500">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <ShieldOff className="size-5" />
      </div>
      <p className="font-medium text-ink-800">Acesso restrito</p>
      <p className="mt-1 max-w-sm text-sm text-ink-500">
        {message ?? 'Seu perfil não tem permissão para acessar este conteúdo.'}
      </p>
    </div>
  )
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger'
  title?: string
  children?: ReactNode
  action?: ReactNode
}) {
  const styles = {
    info: 'border-brand-200 bg-brand-50 text-brand-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
  }[tone]
  return (
    <div className={`flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center ${styles}`}>
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {action}
    </div>
  )
}
