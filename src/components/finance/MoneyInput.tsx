import { forwardRef } from 'react'
import clsx from 'clsx'
import { formatAmountPlain } from '@/lib/finance'

interface MoneyInputProps {
  id?: string
  value: number | null
  onChange: (value: number | null) => void
  invalid?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

/**
 * Valor em reais com máscara de centavos: digitar "150050" mostra "1.500,50".
 * O valor externo é número (reais) ou null quando vazio.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { id, value, onChange, invalid, disabled, placeholder = '0,00', className, autoFocus },
  ref,
) {
  return (
    <div className={clsx('relative', className)}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-400">R$</span>
      <input
        ref={ref}
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        className={clsx('input pl-10 text-right tabular-nums', invalid && 'input-error')}
        value={value == null ? '' : formatAmountPlain(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 15)
          onChange(digits ? Number(digits) / 100 : null)
        }}
      />
    </div>
  )
})
