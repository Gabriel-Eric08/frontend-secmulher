import type { ReactNode } from 'react'
import clsx from 'clsx'

type Tone = 'brand' | 'danger' | 'neutral'

const TONE = {
  brand: { ring: 'border-brand-200', core: 'bg-brand-50 text-brand-700 ring-brand-200', orb: 'bg-brand-300' },
  danger: { ring: 'border-red-200', core: 'bg-red-50 text-red-600 ring-red-200', orb: 'bg-red-300' },
  neutral: { ring: 'border-ink-200', core: 'bg-ink-100 text-ink-500 ring-ink-200', orb: 'bg-ink-300' },
}

/** Ícone no centro de anéis concêntricos que flutuam devagar. */
export function StatusIllustration({ icon, tone = 'brand', size = 'lg' }: { icon: ReactNode; tone?: Tone; size?: 'md' | 'lg' }) {
  const t = TONE[tone]
  const lg = size === 'lg'
  return (
    <div className={clsx('relative flex items-center justify-center', lg ? 'size-44' : 'size-28')} aria-hidden>
      <span className={clsx('absolute inset-0 rounded-full border border-dashed opacity-60', t.ring)} />
      <span className={clsx('absolute rounded-full border opacity-80', lg ? 'inset-5' : 'inset-3', t.ring)} />
      <span className={clsx('absolute top-3 right-6 size-2.5 animate-float rounded-full opacity-70', t.orb)} />
      <span
        className={clsx('absolute bottom-6 left-3 size-1.5 animate-float rounded-full opacity-60', t.orb)}
        style={{ animationDelay: '-2s' }}
      />
      <div
        className={clsx(
          'relative flex animate-float items-center justify-center rounded-3xl ring-1 shadow-(--shadow-glow)',
          lg ? 'size-20 [&_svg]:size-9' : 'size-14 [&_svg]:size-6',
          t.core,
        )}
        style={{ animationDelay: '-1s' }}
      >
        {icon}
      </div>
    </div>
  )
}

/**
 * Tela de status (404, acesso negado, erro). `compact` encaixa dentro de um cartão;
 * sem ele, ocupa a área da página.
 */
export function StatusScreen({
  icon,
  tone = 'brand',
  code,
  title,
  description,
  actions,
  compact,
  children,
}: {
  icon: ReactNode
  tone?: Tone
  code?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  compact?: boolean
  children?: ReactNode
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center px-6 text-center animate-fade-up',
        compact ? 'py-12' : 'min-h-[60vh] justify-center py-16',
      )}
    >
      <StatusIllustration icon={icon} tone={tone} size={compact ? 'md' : 'lg'} />
      {code && (
        <p className="mt-6 bg-gradient-to-br from-brand-500 to-brand-800 bg-clip-text font-mono text-sm font-semibold tracking-[0.3em] text-transparent">
          {code}
        </p>
      )}
      <h1 className={clsx('font-semibold tracking-tight text-ink-900', compact ? 'mt-4 text-base' : 'mt-2 text-2xl')}>
        {title}
      </h1>
      {description && (
        <p className={clsx('mt-2 max-w-md text-ink-500', compact ? 'text-sm' : 'text-[15px] leading-relaxed')}>
          {description}
        </p>
      )}
      {children}
      {actions && <div className="mt-7 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  )
}
