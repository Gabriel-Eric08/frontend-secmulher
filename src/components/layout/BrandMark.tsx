import clsx from 'clsx'

/** Marca simples do sistema (substituível pela identidade visual oficial). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={clsx('size-8', className)} aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--color-brand-700)" />
      <circle cx="16" cy="13" r="6" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M16 19v8M12 23.5h8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
