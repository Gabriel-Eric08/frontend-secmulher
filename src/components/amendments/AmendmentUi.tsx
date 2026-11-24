import { ArrowRight, CalendarClock, Hourglass, OctagonAlert } from 'lucide-react'
import type { Amendment, AmendmentStatus, PendencyKind } from '@/api'
import {
  AMENDMENT_STATUS_LABEL,
  AMENDMENT_STATUS_TONE,
  AMENDMENT_STATUSES,
  PENDENCY_KIND_LABEL,
  PENDENCY_KIND_TONE,
  amendmentFieldLabel,
  deadlineInfo,
} from '@/lib/amendments'
import { formatMoney } from '@/lib/finance'
import { formatValue } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'

export function AmendmentStatusBadge({ status }: { status: AmendmentStatus }) {
  return <Badge tone={AMENDMENT_STATUS_TONE[status]}>{AMENDMENT_STATUS_LABEL[status]}</Badge>
}

export function PendencyKindBadge({ kind }: { kind: PendencyKind }) {
  const Icon = kind === 'IMPEDIMENT' ? OctagonAlert : Hourglass
  return (
    <Badge tone={PENDENCY_KIND_TONE[kind]} icon={<Icon className="size-3" />}>
      {PENDENCY_KIND_LABEL[kind]}
    </Badge>
  )
}

/** Prazo da vigência do TF; nada quando não há vigência ou a emenda está encerrada. */
export function DeadlineBadge({ amendment }: { amendment: Pick<Amendment, 'deadlineStatus' | 'daysToDeadline'> }) {
  const info = deadlineInfo(amendment)
  if (!info) return null
  return (
    <Badge tone={info.tone} icon={<CalendarClock className="size-3" />}>
      {info.label}
    </Badge>
  )
}

/** Valor de uma alteração: situação vira rótulo, valor atual vira moeda. */
function changeValue(key: string, v: unknown): string {
  if (v == null || v === '') return '—'
  if (key === 'status' && typeof v === 'string' && (AMENDMENT_STATUSES as string[]).includes(v))
    return AMENDMENT_STATUS_LABEL[v as AmendmentStatus]
  if (key === 'currentAmount') return formatMoney(Number(v))
  return formatValue(v)
}

function isChange(v: unknown): v is { antigo?: unknown; novo?: unknown } {
  return !!v && typeof v === 'object' && ('antigo' in v || 'novo' in v)
}

/** Lista "campo: antigo → novo" das alterações registradas na linha do tempo. */
export function AmendmentChanges({ changes }: { changes: Record<string, unknown> | null }) {
  const entries = changes ? Object.entries(changes) : []
  if (entries.length === 0) return null
  return (
    <dl className="mt-2 divide-y divide-ink-100 rounded-md border border-ink-200 bg-surface text-xs">
      {entries.map(([key, v]) => (
        <div key={key} className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 px-3 py-1.5">
          <dt className="truncate font-medium text-ink-600">{amendmentFieldLabel(key)}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
            {isChange(v) ? (
              <>
                <span className="break-words text-ink-400 line-through decoration-ink-300">{changeValue(key, v.antigo)}</span>
                <ArrowRight className="size-3 shrink-0 text-ink-400" />
                <span className="break-words font-medium text-ink-800">{changeValue(key, v.novo)}</span>
              </>
            ) : (
              <span className="text-ink-700">{changeValue(key, v)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
