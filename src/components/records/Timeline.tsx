import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowRight,
  ChevronDown,
  Download,
  EyeOff,
  FilePen,
  FilePlus2,
  FileX2,
  PencilLine,
  Plus,
  StickyNote,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { Activity, ActivityChange, ActivityType, ActivityTypeSummary } from '@/api'
import { ACTIVITY_LABEL, formatValue } from '@/lib/format'
import { activityTypeOf, isManualActivity, typeIcon, typeStyles } from '@/lib/activityTypes'
import { EmptyState } from '@/components/ui/States'

const SYSTEM_ICONS: Partial<Record<ActivityType, React.ComponentType<{ className?: string }>>> = {
  CREATED: Plus,
  UPDATED: PencilLine,
  DELETED: Trash2,
  FILE_UPLOADED: FilePlus2,
  FILE_UPDATED: FilePen,
  FILE_REMOVED: FileX2,
  FILE_DOWNLOADED: Download,
}

type View = 'all' | 'manual' | 'system'

// ---------------------------------------------------------------- datas

const when = (a: Activity) => new Date(a.occurredAt ?? a.createdAt)

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(d: Date) {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(d) === dayKey(today)) return 'Hoje'
  if (dayKey(d) === dayKey(yesterday)) return 'Ontem'
  const label = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const timeOf = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

// ---------------------------------------------------------------- alterações

function isChange(v: unknown): v is ActivityChange {
  return !!v && typeof v === 'object' && ('antigo' in v || 'novo' in v)
}

function Changes({ changes, labelFor }: { changes: Activity['changes']; labelFor: (key: string) => string }) {
  const entries = changes && typeof changes === 'object' ? Object.entries(changes) : []
  if (entries.length === 0) return null
  return (
    <dl className="mt-2 divide-y divide-ink-100 rounded-md border border-ink-200 bg-surface text-xs">
      {entries.map(([key, v]) => (
        <div key={key} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 px-3 py-1.5">
          <dt className="truncate font-medium text-ink-600">{labelFor(key)}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
            {isChange(v) ? (
              <>
                <span className="text-ink-400 line-through decoration-ink-300">{formatValue(v.antigo)}</span>
                <ArrowRight className="size-3 shrink-0 text-ink-400" />
                <span className="font-medium text-ink-800">{formatValue(v.novo)}</span>
              </>
            ) : (
              <span className="text-ink-700">{formatValue(v)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function RedactedNote() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-ink-400"
      title="Parte do conteúdo foi ocultada para o seu perfil"
    >
      <EyeOff className="size-3" /> conteúdo ocultado
    </span>
  )
}

/** Etiqueta colorida com o nome de um tipo de registro. */
export function TypeChip({ type, className }: { type: Pick<ActivityTypeSummary, 'label' | 'color'>; className?: string }) {
  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', className)} style={typeStyles(type).chip}>
      {type.label}
    </span>
  )
}

// ---------------------------------------------------------------- itens

function ManualEntry({ a }: { a: Activity }) {
  const type = activityTypeOf(a) ?? { id: '', key: '', label: ACTIVITY_LABEL.MANUAL, color: null }
  const styles = typeStyles(type)
  const Icon = typeIcon(type.key)
  const d = when(a)
  return (
    <li className="relative flex gap-3 pl-0.5">
      <span
        className="relative z-10 mt-3 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface"
        style={styles.icon}
      >
        <Icon className="size-4" />
      </span>
      <article
        className="min-w-0 flex-1 rounded-lg border border-l-4 border-ink-200 bg-surface px-4 py-3 shadow-xs"
        style={styles.accent}
      >
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <TypeChip type={type} />
          <time className="text-xs font-medium text-ink-500 tabular-nums" dateTime={a.occurredAt ?? a.createdAt}>
            {timeOf(d)}
          </time>
          {a.redacted && <RedactedNote />}
        </header>
        {a.description && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-800">{a.description}</p>}
        {(a.responsibleEmployee || a.userName) && (
          <footer className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-100 pt-2 text-xs text-ink-500">
            {a.responsibleEmployee && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3" /> {a.responsibleEmployee}
              </span>
            )}
            {a.userName && a.userName !== a.responsibleEmployee && <span>registrado por {a.userName}</span>}
          </footer>
        )}
      </article>
    </li>
  )
}

function SystemEntry({ a, labelFor }: { a: Activity; labelFor: (key: string) => string }) {
  const [open, setOpen] = useState(false)
  const Icon = SYSTEM_ICONS[a.actionType] ?? StickyNote
  const d = when(a)
  const changeCount = a.changes && typeof a.changes === 'object' ? Object.keys(a.changes).length : 0
  const expandable = a.actionType === 'UPDATED' && changeCount > 0

  return (
    <li className="relative flex gap-3 pl-0.5">
      <span className="relative z-10 mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500 ring-4 ring-surface">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 py-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium text-ink-700">{ACTIVITY_LABEL[a.actionType] ?? a.actionType}</span>
          {a.description && a.actionType !== 'UPDATED' && (
            <span className="truncate text-ink-500">· {a.description}</span>
          )}
          {expandable && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-700 hover:underline"
              aria-expanded={open}
            >
              {changeCount} {changeCount === 1 ? 'campo' : 'campos'}
              <ChevronDown className={clsx('size-3 transition-transform', open && 'rotate-180')} />
            </button>
          )}
          {a.redacted && <RedactedNote />}
        </div>
        <p className="text-xs text-ink-400">
          {timeOf(d)}
          {a.userName && ` · ${a.userName}`}
        </p>
        {expandable && open && <Changes changes={a.changes} labelFor={labelFor} />}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------- linha do tempo

function Segmented({
  value,
  onChange,
  options,
}: {
  value: View
  onChange: (v: View) => void
  options: { value: View; label: string; count: number }[]
}) {
  return (
    <div className="inline-flex rounded-md border border-ink-200 bg-ink-50 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
            value === o.value ? 'bg-surface text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {o.label}
          <span className="text-ink-400 tabular-nums">{o.count}</span>
        </button>
      ))}
    </div>
  )
}

export function Timeline({
  activities,
  labelFor = (k) => k,
}: {
  activities: Activity[]
  labelFor?: (key: string) => string
}) {
  const [view, setView] = useState<View>('all')
  /** keys dos tipos selecionados no filtro (vazio = todos) */
  const [types, setTypes] = useState<Set<string>>(new Set())

  const manualCount = activities.filter(isManualActivity).length

  // Tipos presentes nos registros, na ordem em que aparecem pela primeira vez
  const presentTypes = useMemo(() => {
    const map = new Map<string, ActivityTypeSummary & { count: number }>()
    for (const a of activities) {
      const t = isManualActivity(a) ? activityTypeOf(a) : null
      if (!t) continue
      const cur = map.get(t.key)
      if (cur) cur.count++
      else map.set(t.key, { ...t, count: 1 })
    }
    return [...map.values()]
  }, [activities])

  const groups = useMemo(() => {
    const filtered = activities
      .filter((a) => {
        const manual = isManualActivity(a)
        if (view === 'manual' && !manual) return false
        if (view === 'system' && manual) return false
        if (types.size > 0) {
          const key = manual ? activityTypeOf(a)?.key : undefined
          if (!key || !types.has(key)) return false
        }
        return true
      })
      .sort((a, b) => when(b).getTime() - when(a).getTime())

    const out: { key: string; label: string; items: Activity[] }[] = []
    for (const a of filtered) {
      const d = when(a)
      const key = dayKey(d)
      const last = out[out.length - 1]
      if (last?.key === key) last.items.push(a)
      else out.push({ key, label: dayLabel(d), items: [a] })
    }
    return out
  }, [activities, view, types])

  if (activities.length === 0) {
    return (
      <EmptyState
        title="Nenhum registro na linha do tempo"
        description="Atendimentos e alterações do cadastro aparecerão aqui."
      />
    )
  }

  const toggleType = (key: string) =>
    setTypes((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={view}
          onChange={(v) => {
            setView(v)
            if (v === 'system') setTypes(new Set())
          }}
          options={[
            { value: 'all', label: 'Tudo', count: activities.length },
            { value: 'manual', label: 'Atendimentos', count: manualCount },
            { value: 'system', label: 'Sistema', count: activities.length - manualCount },
          ]}
        />
        {view !== 'system' && presentTypes.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {presentTypes.map((t) => {
              const active = types.has(t.key)
              return (
                <button
                  key={t.key}
                  onClick={() => toggleType(t.key)}
                  aria-pressed={active}
                  style={active ? typeStyles(t).chip : undefined}
                  className={clsx(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                    !active && 'text-ink-500 ring-1 ring-ink-200 ring-inset hover:text-ink-800',
                  )}
                >
                  {t.label} <span className="opacity-60 tabular-nums">{t.count}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <EmptyState title="Nenhum registro com esses filtros" />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="mb-3 flex items-center gap-3 text-xs font-semibold tracking-wide text-ink-500 uppercase">
                {g.label}
                <span className="h-px flex-1 bg-ink-200" />
                <span className="font-normal normal-case tracking-normal text-ink-400">
                  {g.items.length} {g.items.length === 1 ? 'registro' : 'registros'}
                </span>
              </h3>
              <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[18px] before:w-px before:bg-ink-200">
                {g.items.map((a) =>
                  isManualActivity(a) ? (
                    <ManualEntry key={a.id} a={a} />
                  ) : (
                    <SystemEntry key={a.id} a={a} labelFor={labelFor} />
                  ),
                )}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
