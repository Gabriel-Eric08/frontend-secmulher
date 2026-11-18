import clsx from 'clsx'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePreference } from './ThemeContext'

/** Botão redondo que alterna claro/escuro, com o ícone girando na troca. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      className={clsx(
        'relative inline-flex size-9 items-center justify-center overflow-hidden rounded-full text-ink-500 transition-colors hover:bg-ink-100 hover:text-brand-700',
        className,
      )}
    >
      <Sun
        className={clsx(
          'absolute size-[18px] transition-all duration-300',
          dark ? 'scale-50 -rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100',
        )}
      />
      <Moon
        className={clsx(
          'absolute size-[18px] transition-all duration-300',
          dark ? 'scale-100 rotate-0 opacity-100' : 'scale-50 rotate-90 opacity-0',
        )}
      />
    </button>
  )
}

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
]

/** Seletor de três opções (perfil): claro, escuro ou seguir o sistema. */
export function ThemeSelector() {
  const { preference, setPreference } = useTheme()
  return (
    <div className="grid w-full grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label="Tema">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          onClick={() => setPreference(value)}
          className={clsx(
            'flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm transition-all duration-200',
            preference === value
              ? 'bg-surface font-medium text-brand-700 shadow-sm'
              : 'text-ink-500 hover:text-ink-800',
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  )
}
