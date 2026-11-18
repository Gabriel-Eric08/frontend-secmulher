import clsx from 'clsx'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { BrandMark } from '@/components/layout/BrandMark'

/** Anel com um arco na cor de destaque girando. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx('size-5 animate-spin-slow', className)} role="status" aria-label="Carregando">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink-200" />
      <path
        d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="text-brand-600"
      />
    </svg>
  )
}

/** Tela de abertura: marca pulsando e barra correndo por baixo. */
export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-50 animate-fade-in">
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-xl bg-brand-400/30" />
        <BrandMark className="relative size-12" />
      </div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-ink-200">
        <div className="h-full w-full origin-left animate-progress rounded-full bg-accent" />
      </div>
      <p className="text-xs text-ink-400">Carregando…</p>
    </div>
  )
}

/** Bloco cinza com brilho percorrendo, no formato do conteúdo que vai chegar. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />
}

/**
 * Carregamento de um bloco de conteúdo. Por padrão mostra linhas-esqueleto
 * (lista/tabela); `variant="spinner"` mostra só o anel.
 */
export function LoadingBlock({
  label = 'Carregando…',
  variant = 'rows',
  rows = 4,
}: {
  label?: string
  variant?: 'rows' | 'spinner'
  rows?: number
}) {
  if (variant === 'spinner') {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-500 animate-fade-in">
        <Spinner /> {label}
      </div>
    )
  }
  return (
    <div className="space-y-4 p-5 animate-fade-in" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4" style={{ opacity: 1 - i * 0.18 }}>
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="hidden h-3.5 w-20 sm:block" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** Esqueleto de página de detalhe: cabeçalho, indicadores e lista. */
export function PageSkeleton() {
  return (
    <div className="animate-fade-in" role="status" aria-label="Carregando">
      <Skeleton className="mb-3 h-3 w-40" />
      <Skeleton className="mb-2 h-7 w-72" />
      <Skeleton className="mb-8 h-4 w-52" />
      <div className="card mb-6 grid gap-6 p-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-36" />
          </div>
        ))}
        <Skeleton className="h-3 sm:col-span-3" />
      </div>
      <div className="card">
        <LoadingBlock rows={5} />
      </div>
    </div>
  )
}

/**
 * Barra fina no topo da tela enquanto há requisições em andamento.
 * Só aparece se a espera passar de 200 ms, para não piscar em respostas rápidas.
 */
export function TopProgressBar() {
  const busy = useIsFetching() + useIsMutating() > 0
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!busy) {
      setVisible(false)
      return
    }
    const t = window.setTimeout(() => setVisible(true), 200)
    return () => window.clearTimeout(t)
  }, [busy])
  return (
    <div
      className={clsx(
        'pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden
    >
      <div className="h-full w-full origin-left animate-progress bg-gradient-to-r from-brand-400 via-accent to-brand-400" />
    </div>
  )
}
