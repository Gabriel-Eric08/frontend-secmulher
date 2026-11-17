import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Lock, ShieldAlert, ShieldCheck, Shield } from 'lucide-react'
import type { ConfidentialityLevel } from '@/api'
import { CONFIDENTIALITY_HINT, CONFIDENTIALITY_LABEL } from '@/lib/format'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
}

export function Badge({
  tone = 'neutral',
  children,
  icon,
  className,
  title,
}: {
  tone?: Tone
  children: ReactNode
  icon?: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

export function ConfidentialityBadge({ level }: { level: ConfidentialityLevel }) {
  const map = {
    INTERNAL: { tone: 'neutral' as const, Icon: Shield },
    RESTRICTED: { tone: 'warning' as const, Icon: ShieldCheck },
    CONFIDENTIAL: { tone: 'danger' as const, Icon: ShieldAlert },
  }[level]
  return (
    <Badge tone={map.tone} icon={<map.Icon className="size-3" />} title={CONFIDENTIALITY_HINT[level]}>
      {CONFIDENTIALITY_LABEL[level]}
    </Badge>
  )
}

/** Marca um valor que existe mas o usuário não tem permissão de ler. */
export function HiddenValue() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-400" title="Sem permissão para visualizar">
      <Lock className="size-3" /> restrito
    </span>
  )
}
