import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { UserRound } from 'lucide-react'
import { normalize } from '@/lib/format'

/**
 * Texto livre com sugestões: conforme a pessoa digita, aparecem os nomes já usados
 * em outras tarefas (contém, sem acento nem maiúsculas). Nada obriga a escolher um deles.
 */
export function ResponsibleInput({
  id,
  value,
  onChange,
  suggestions,
  invalid,
  placeholder = 'Nome de quem vai cuidar',
}: {
  id: string
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  invalid?: boolean
  placeholder?: string
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listRef = useRef<HTMLUListElement>(null)

  const matches = useMemo(() => {
    const q = normalize(value.trim())
    const list = q ? suggestions.filter((s) => normalize(s).includes(q)) : suggestions
    // o que já está digitado igualzinho não precisa aparecer como sugestão
    return list.filter((s) => s !== value.trim()).slice(0, 8)
  }, [value, suggestions])

  const show = open && matches.length > 0

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!show) {
      if (e.key === 'ArrowDown' && matches.length) {
        setOpen(true)
        setActive(0)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      setActive((i) => (i + 1) % matches.length)
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1))
      e.preventDefault()
    } else if (e.key === 'Enter' && active >= 0) {
      pick(matches[active])
      e.preventDefault()
    } else if (e.key === 'Escape') {
      setOpen(false)
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div className="relative">
      <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
      <input
        id={id}
        className={clsx('input pl-9', invalid && 'input-error')}
        value={value}
        maxLength={255}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        // espera o clique numa sugestão antes de fechar
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {show && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-ink-200 bg-surface py-1 shadow-(--shadow-pop) animate-fade-in"
        >
          {matches.map((name, i) => (
            <li
              key={name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(name)}
              onMouseEnter={() => setActive(i)}
              className={clsx('cursor-pointer truncate px-3 py-1.5 text-sm', i === active ? 'bg-brand-50 text-brand-800' : 'text-ink-700')}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
