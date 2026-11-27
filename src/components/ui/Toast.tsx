import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { errorMessage } from '@/api'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (messageOrError: unknown) => void
  /** Aviso neutro (ex.: movimento que o sistema não permite) */
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)
let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++seq
      setItems((xs) => [...xs.slice(-3), { id, kind, message }])
      setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (e) => push('error', typeof e === 'string' ? e : errorMessage(e)),
      info: (m) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
          {items.map((t) => (
            <div
              key={t.id}
              role="status"
              className={clsx(
                'pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-(--shadow-pop)',
                t.kind === 'success' ? 'border-emerald-200' : t.kind === 'info' ? 'border-brand-200' : 'border-red-200',
              )}
            >
              {t.kind === 'success' ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : t.kind === 'info' ? (
                <Info className="mt-0.5 size-4 shrink-0 text-brand-600" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
              )}
              <p className="flex-1 text-ink-700">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-700" aria-label="Fechar">
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return ctx
}
