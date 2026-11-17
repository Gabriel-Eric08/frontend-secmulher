import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Lock, Search } from 'lucide-react'

interface FieldProps {
  label: string
  htmlFor?: string
  error?: string
  hint?: ReactNode
  required?: boolean
  locked?: boolean
  children: ReactNode
  className?: string
}

/** Rótulo + controle + erro/dica. `locked` indica coluna sem permissão de escrita. */
export function Field({ label, htmlFor, error, hint, required, locked, children, className }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label flex items-center gap-1.5">
        {label}
        {required && <span className="text-red-600">*</span>}
        {locked && (
          <span title="Sem permissão para alterar" className="text-ink-400">
            <Lock className="size-3" />
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} className={clsx('input', invalid && 'input-error', className)} {...rest} />
})

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid, className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={clsx('input pr-8', invalid && 'input-error', className)} {...rest}>
      {children}
    </select>
  )
})

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx('input min-h-24', invalid && 'input-error', className)} {...rest} />
})

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={clsx('flex cursor-pointer items-start gap-2.5 text-sm', rest.disabled && 'cursor-not-allowed opacity-60', className)}>
      <input type="checkbox" className="mt-0.5 size-4 rounded border-ink-300 accent-brand-700" {...rest} />
      <span>
        <span className="text-ink-800">{label}</span>
        {description && <span className="block text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  )
}

/** Interruptor visual para booleanos. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={clsx('inline-flex cursor-pointer items-center gap-3 text-sm', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand-700' : 'bg-ink-300',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        />
      </button>
      <span className="text-ink-800">{label}</span>
    </label>
  )
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
      <input type="search" className="input pl-9" {...rest} />
    </div>
  )
}
