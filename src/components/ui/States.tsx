import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle, ArrowLeft, Home, Inbox, Info, LockKeyhole, RotateCw, WifiOff } from 'lucide-react'
import { ApiError, errorMessage } from '@/api'
import { Button, ButtonLink } from './Button'
import { StatusScreen } from './StatusScreen'

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
    <div className="flex flex-col items-center px-6 py-14 text-center animate-fade-in">
      <div className="relative mb-4">
        <span className="absolute -inset-2 rounded-2xl bg-brand-50 opacity-60" aria-hidden />
        <div className="relative flex size-12 items-center justify-center rounded-xl bg-surface text-brand-600 shadow-sm ring-1 ring-ink-200">
          {icon ?? <Inbox className="size-5" />}
        </div>
      </div>
      <p className="font-medium text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (error instanceof ApiError && error.isForbidden) return <ForbiddenState message={error.detail} compact />
  const offline = error instanceof ApiError && error.status === 0
  return (
    <StatusScreen
      compact
      tone="danger"
      icon={offline ? <WifiOff /> : <AlertTriangle />}
      title={offline ? 'Sem conexão com o servidor' : 'Não foi possível carregar'}
      description={errorMessage(error)}
      actions={
        onRetry && (
          <Button variant="secondary" size="sm" icon={<RotateCw className="size-3.5" />} onClick={onRetry}>
            Tentar novamente
          </Button>
        )
      }
    />
  )
}

/** Acesso negado: explica e oferece caminho de volta. */
export function ForbiddenState({ message, compact }: { message?: string; compact?: boolean }) {
  const navigate = useNavigate()
  return (
    <StatusScreen
      compact={compact}
      icon={<LockKeyhole />}
      code={compact ? undefined : '403'}
      title="Acesso restrito"
      description={message ?? 'Seu perfil não tem permissão para acessar este conteúdo.'}
      actions={
        <>
          <Button variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <ButtonLink to="/" icon={<Home className="size-4" />}>
            Ir para o painel
          </ButtonLink>
        </>
      }
    >
      {!compact && (
        <p className="mt-4 rounded-lg bg-ink-100 px-3 py-2 text-xs text-ink-500">
          Precisa deste acesso? Peça à administração para ajustar suas permissões.
        </p>
      )}
    </StatusScreen>
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
    info: { box: 'border-brand-200 bg-brand-50 text-brand-900', icon: 'text-brand-600', Icon: Info },
    warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: 'text-amber-700', Icon: AlertTriangle },
    danger: { box: 'border-red-200 bg-red-50 text-red-900', icon: 'text-red-600', Icon: AlertTriangle },
  }[tone]
  return (
    <div
      className={clsx(
        'flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-down sm:flex-row sm:items-center',
        styles.box,
      )}
    >
      <div className="flex flex-1 gap-3">
        <styles.Icon className={clsx('mt-0.5 size-4 shrink-0', styles.icon)} />
        <div className="flex-1">
          {title && <p className="font-medium">{title}</p>}
          {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
        </div>
      </div>
      {action}
    </div>
  )
}
