import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { initials } from '@/lib/format'

export interface Crumb {
  label: string
  to?: string
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  breadcrumbs?: Crumb[]
}) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-ink-500" aria-label="Navegação">
          {breadcrumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3" />}
              {c.to ? (
                <Link to={c.to} className="hover:text-brand-700">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-ink-100 px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function Avatar({ name, size = 'md' }: { name: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700',
        { sm: 'size-7 text-xs', md: 'size-9 text-sm', lg: 'size-14 text-lg' }[size],
      )}
    >
      {initials(name)}
    </span>
  )
}

/** Lista de pares rótulo/valor para fichas. */
export function DescriptionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase">{it.label}</dt>
          <dd className="mt-1 text-sm text-ink-900">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Abas com um indicador que desliza até a aba ativa. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value, tabs.length])

  return (
    <div ref={listRef} className="relative flex gap-1 overflow-x-auto border-b border-ink-200" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            'my-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            value === t.value ? 'text-brand-800' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800',
          )}
        >
          {t.label}
          {t.count != null && (
            <span
              className={clsx(
                'rounded-full px-1.5 py-px text-xs tabular-nums transition-colors',
                value === t.value ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600',
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
      {indicator && (
        <span
          className="absolute bottom-0 h-0.5 rounded-full bg-accent transition-all duration-300 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
          aria-hidden
        />
      )}
    </div>
  )
}

export function StatCard({ label, value, hint, icon, to }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; to?: string }) {
  const content = (
    <div className={clsx('card group flex items-start justify-between gap-3 p-5', to && 'card-interactive')}>
      <div className="min-w-0">
        <p className="text-sm text-ink-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-ink-900 tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      </div>
      {icon && (
        <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700 transition-all duration-200 group-hover:scale-105 group-hover:bg-accent group-hover:text-white">
          {icon}
        </div>
      )}
    </div>
  )
  return to ? (
    <Link to={to} className="block rounded-xl">
      {content}
    </Link>
  ) : (
    content
  )
}
