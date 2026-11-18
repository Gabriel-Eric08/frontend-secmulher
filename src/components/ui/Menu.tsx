import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { buttonClass } from './Button'

export interface MenuItem {
  label: string
  description?: string
  icon?: ReactNode
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
}

/** Botão com menu suspenso (fecha ao clicar fora ou com Esc). */
export function MenuButton({
  label,
  icon,
  items,
  variant = 'secondary',
  align = 'right',
}: {
  label: string
  icon?: ReactNode
  items: (MenuItem | null | false | undefined)[]
  variant?: 'primary' | 'secondary'
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const visible = items.filter(Boolean) as MenuItem[]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (visible.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={buttonClass(variant, 'md')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        {label}
        <ChevronDown className={clsx('size-4 opacity-60 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="menu"
          className={clsx(
            'absolute z-40 mt-1.5 w-72 animate-scale-in overflow-hidden rounded-xl border border-ink-200 bg-surface p-1 shadow-(--shadow-pop)',
            align === 'right' ? 'origin-top-right' : 'origin-top-left',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {visible.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              type="button"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
              className={clsx(
                'group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-40',
                it.danger ? 'text-red-600 hover:bg-red-50' : 'text-ink-800 hover:bg-brand-50 hover:text-brand-900',
              )}
            >
              {it.icon && (
                <span
                  className={clsx(
                    'mt-0.5 shrink-0 transition-transform group-hover:scale-110',
                    it.danger ? '' : 'text-brand-600',
                  )}
                >
                  {it.icon}
                </span>
              )}
              <span className="min-w-0">
                <span className="block font-medium">{it.label}</span>
                {it.description && <span className="block text-xs text-ink-500">{it.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
