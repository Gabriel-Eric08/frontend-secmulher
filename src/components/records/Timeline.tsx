import clsx from 'clsx'
import {
  ArrowRight,
  ClipboardList,
  Download,
  EyeOff,
  FilePen,
  FilePlus2,
  FileX2,
  HeartHandshake,
  PencilLine,
  Plus,
  StickyNote,
  Trash2,
  Repeat,
} from 'lucide-react'
import type { Activity, ActivityChange, ActivityType } from '@/api'
import { ACTIVITY_LABEL, formatDateTime, formatValue } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  TRIAGE: ClipboardList,
  SERVICE: HeartHandshake,
  FOLLOW_UP: Repeat,
  NOTE: StickyNote,
  CREATED: Plus,
  UPDATED: PencilLine,
  DELETED: Trash2,
  FILE_UPLOADED: FilePlus2,
  FILE_UPDATED: FilePen,
  FILE_REMOVED: FileX2,
  FILE_DOWNLOADED: Download,
}

const MANUAL = new Set<ActivityType>(['TRIAGE', 'SERVICE', 'FOLLOW_UP', 'NOTE'])

function isChange(v: unknown): v is ActivityChange {
  return !!v && typeof v === 'object' && ('antigo' in v || 'novo' in v)
}

function Changes({ changes, labelFor }: { changes: Activity['changes']; labelFor: (key: string) => string }) {
  if (!changes || typeof changes !== 'object') return null
  const entries = Object.entries(changes)
  if (entries.length === 0) return null
  return (
    <ul className="mt-2 space-y-1 rounded-md bg-ink-50 px-3 py-2 text-xs">
      {entries.map(([key, v]) => (
        <li key={key} className="flex flex-wrap items-center gap-1.5 text-ink-600">
          <span className="font-medium text-ink-700">{labelFor(key)}:</span>
          {isChange(v) ? (
            <>
              <span className="text-ink-500 line-through decoration-ink-300">{formatValue(v.antigo)}</span>
              <ArrowRight className="size-3 text-ink-400" />
              <span className="text-ink-800">{formatValue(v.novo)}</span>
            </>
          ) : (
            <span>{formatValue(v)}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function Timeline({
  activities,
  labelFor = (k) => k,
}: {
  activities: Activity[]
  labelFor?: (key: string) => string
}) {
  if (activities.length === 0) {
    return <EmptyState title="Nenhum registro na linha do tempo" description="Atendimentos e alterações aparecerão aqui." />
  }

  const sorted = [...activities].sort(
    (a, b) =>
      new Date(b.occurredAt ?? b.createdAt ?? 0).getTime() - new Date(a.occurredAt ?? a.createdAt ?? 0).getTime(),
  )

  return (
    <ol className="relative">
      {sorted.map((a, i) => {
        const Icon = ICONS[a.actionType] ?? StickyNote
        const manual = MANUAL.has(a.actionType)
        return (
          <li key={a.id} className="relative flex gap-4 pb-6 last:pb-0">
            {i < sorted.length - 1 && <span className="absolute top-9 bottom-0 left-[17px] w-px bg-ink-200" aria-hidden />}
            <span
              className={clsx(
                'relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white',
                manual ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-500',
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className={clsx('text-sm font-medium', manual ? 'text-ink-900' : 'text-ink-700')}>
                  {ACTIVITY_LABEL[a.actionType] ?? a.actionType}
                </p>
                {a.redacted && (
                  <Badge icon={<EyeOff className="size-3" />} title="Parte do conteúdo foi ocultada para o seu perfil">
                    conteúdo ocultado
                  </Badge>
                )}
                <span className="text-xs text-ink-500">{formatDateTime(a.occurredAt ?? a.createdAt)}</span>
              </div>
              {a.description && <p className="mt-1 text-sm whitespace-pre-line text-ink-700">{a.description}</p>}
              <Changes changes={a.changes} labelFor={labelFor} />
              {(a.responsibleEmployee || a.userName) && (
                <p className="mt-1.5 text-xs text-ink-500">
                  {a.responsibleEmployee ? `Responsável: ${a.responsibleEmployee}` : `Por ${a.userName}`}
                  {a.responsibleEmployee && a.userName && a.userName !== a.responsibleEmployee && ` · registrado por ${a.userName}`}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
