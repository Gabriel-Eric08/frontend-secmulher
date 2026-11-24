import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleCheck,
  FileEdit,
  Flag,
  Hourglass,
  Import,
  MessageSquarePlus,
  NotebookPen,
  OctagonAlert,
  Pencil,
  RotateCcw,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react'
import type { Amendment, AmendmentActivity, AmendmentActivityKind, AmendmentPendency } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useAmendment, useAmendmentPendencies, useAmendmentTimeline, useDeleteAmendment } from '@/queries/amendments'
import { ACTIVITY_KIND_TONE, SHEET_SECTIONS, amendmentTitle, daysLabel, idleLabel, isClosed, responsibleOf } from '@/lib/amendments'
import { formatMoney } from '@/lib/finance'
import { formatDateTimeLocal } from '@/lib/fleet'
import { formatDate } from '@/lib/format'
import { Card, PageHeader, Tabs } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { MenuButton } from '@/components/ui/Menu'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock, PageSkeleton } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { AmendmentChanges, AmendmentStatusBadge, DeadlineBadge, PendencyKindBadge } from '@/components/amendments/AmendmentUi'
import { AmendmentActionModal, ResolvePendencyModal, type AmendmentAction } from '@/components/amendments/AmendmentModals'

type Tab = 'dados' | 'pendencias' | 'linha'

export function EmendaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const { amendmentsAccess: access } = useAuth()
  const amendment = useAmendment(access.canRead ? id : undefined)
  const pendencies = useAmendmentPendencies(access.canRead ? id : undefined)
  const del = useDeleteAmendment()
  const [tab, setTab] = useState<Tab>('dados')
  const [action, setAction] = useState<AmendmentAction | null>(null)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de emendas." />
  if (amendment.isPending) return <PageSkeleton />
  if (amendment.isError) return <ErrorState error={amendment.error} onRetry={() => amendment.refetch()} />

  const a = amendment.data
  const closed = isClosed(a.status)
  const openCount = (pendencies.data ?? []).filter((p) => p.open).length

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir emenda',
      message: (
        <>
          A emenda <strong>{amendmentTitle(a)}</strong> será excluída com as pendências e toda a linha do tempo. Não é possível
          desfazer.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(a.id)
      toast.success('Emenda excluída.')
      navigate('/emendas')
    } catch (err) {
      toast.error(err)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Emendas', to: '/emendas' }, { label: a.code ? `COD ${a.code}` : a.parliamentarian }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {a.parliamentarian}
            <AmendmentStatusBadge status={a.status} />
            <DeadlineBadge amendment={a} />
          </span>
        }
        description={[a.code && `COD ${a.code}`, a.alepeCode && `ALEPE ${a.alepeCode}`, `LOA ${a.exerciseYear}`, a.cycle].filter(Boolean).join(' · ')}
        actions={
          <>
            {access.canUpdate && (
              <Button variant="secondary" icon={<MessageSquarePlus className="size-4" />} onClick={() => setAction('note')}>
                Anotar
              </Button>
            )}
            {access.canUpdate && !closed && (
              <>
                <Button variant="secondary" icon={<Hourglass className="size-4" />} onClick={() => setAction('pendency')}>
                  Pendência
                </Button>
                <ButtonLink to={`/emendas/${a.id}/editar`} variant="secondary" icon={<Pencil className="size-4" />}>
                  Editar
                </ButtonLink>
                <Button icon={<Flag className="size-4" />} onClick={() => setAction('complete')}>
                  Concluir
                </Button>
              </>
            )}
            {access.canUpdate && closed && (
              <Button icon={<RotateCcw className="size-4" />} onClick={() => setAction('reopen')}>
                Reabrir
              </Button>
            )}
            <MenuButton
              label="Mais"
              items={[
                access.canUpdate &&
                  !closed && { label: 'Cancelar emenda', icon: <Ban className="size-4" />, onSelect: () => setAction('cancel'), danger: true },
                access.canDelete && { label: 'Excluir emenda', icon: <Trash2 className="size-4" />, onSelect: onDelete, danger: true },
              ]}
            />
          </>
        }
      />

      {a.status === 'COMPLETED' && (
        <ClosedBanner tone="success" title={`Concluída em ${formatDateTimeLocal(a.completedAt)}`} by={a.completedBy?.name} />
      )}
      {a.status === 'CANCELLED' && (
        <ClosedBanner tone="neutral" title={`Cancelada em ${formatDateTimeLocal(a.cancelledAt)}`} by={a.cancelledBy?.name} />
      )}

      <SummaryStrip amendment={a} />

      <div className="mt-6 mb-5">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'dados', label: 'Dados da planilha' },
            { value: 'pendencias', label: 'Pendências', count: openCount || undefined },
            { value: 'linha', label: 'Linha do tempo' },
          ]}
        />
      </div>

      {tab === 'dados' && <DataTab amendment={a} />}
      {tab === 'pendencias' && (
        <PendenciesTab
          amendment={a}
          pendencies={pendencies.data}
          loading={pendencies.isPending}
          error={pendencies.error}
          onRetry={() => pendencies.refetch()}
          onOpen={() => setAction('pendency')}
        />
      )}
      {tab === 'linha' && <TimelineTab amendmentId={a.id} />}

      {action && <AmendmentActionModal amendment={a} action={action} onClose={() => setAction(null)} />}
    </>
  )
}

function ClosedBanner({ tone, title, by }: { tone: 'success' | 'neutral'; title: string; by?: string | null }) {
  return (
    <div
      className={clsx(
        'mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-down',
        tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-ink-200 bg-ink-100/60 text-ink-800',
      )}
    >
      {tone === 'success' ? <CircleCheck className="size-4 shrink-0 text-emerald-600" /> : <Ban className="size-4 shrink-0 text-ink-500" />}
      <p>
        <span className="font-medium">{title}</span>
        {by && <span className="opacity-80"> por {by}</span>}
        <span className="opacity-80"> · Reabra para editar ou abrir pendências. Anotações continuam liberadas.</span>
      </p>
    </div>
  )
}

/** Faixa com os números que mais importam no acompanhamento. */
function SummaryStrip({ amendment: a }: { amendment: Amendment }) {
  const items: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode }[] = [
    { label: 'Valor atual', value: formatMoney(a.currentAmount), icon: <Wallet className="size-4" /> },
    {
      label: 'Vigência do TF',
      value: formatDate(a.termEndDate),
      sub: a.termNumber ? `TF ${a.termNumber}` : 'Sem Termo de Fomento',
      icon: <CalendarClock className="size-4" />,
    },
    {
      label: 'Pendências abertas',
      value: a.openPendencies,
      sub: a.oldestOpenPendencyAt ? `mais antiga desde ${formatDate(a.oldestOpenPendencyAt)}` : 'nenhuma',
      icon: <Hourglass className="size-4" />,
    },
    {
      label: 'Última atividade',
      value: formatDate(a.lastActivityAt),
      sub: idleLabel(a.idleDays),
      icon: <NotebookPen className="size-4" />,
    },
    {
      label: 'Responsável',
      value: responsibleOf(a) ?? '—',
      sub: a.sector?.name ?? 'Sem setor',
      icon: <UserRound className="size-4" />,
    },
  ]
  return (
    <div className="card grid grid-cols-2 divide-ink-100 sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      {items.map((it) => (
        <div key={it.label} className="min-w-0 px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <span className="text-brand-600">{it.icon}</span>
            {it.label}
          </p>
          <p className="mt-1 truncate text-base font-semibold text-ink-900 tabular-nums">{it.value}</p>
          {it.sub && <p className="truncate text-xs text-ink-500">{it.sub}</p>}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Dados

function DataTab({ amendment: a }: { amendment: Amendment }) {
  const [hideEmpty, setHideEmpty] = useState(false)
  const special: Record<string, { label: string; value: ReactNode; filled: boolean }> = {
    exerciseYear: { label: 'Ano (LOA)', value: a.exerciseYear, filled: true },
    parliamentarian: { label: 'Parlamentar', value: a.parliamentarian, filled: true },
    currentAmount: { label: 'Valor atual', value: formatMoney(a.currentAmount), filled: a.currentAmount != null },
    sector: { label: 'Setor', value: a.sector?.name ?? '—', filled: !!a.sector },
    responsible: {
      label: 'Técnica responsável',
      value: responsibleOf(a) ? (
        <span className="flex flex-wrap items-center gap-2">
          {responsibleOf(a)}
          {a.responsibleUser && <Badge tone="brand">usuária do sistema</Badge>}
        </span>
      ) : (
        '—'
      ),
      filled: !!responsibleOf(a),
    },
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex justify-end">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-500">
          <input type="checkbox" className="size-3.5 accent-accent" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
          Ocultar campos vazios
        </label>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {SHEET_SECTIONS.map((section) => {
          const items = [
            ...(section.special ?? []).map((k) => ({ key: k, wide: false, ...special[k] })),
            ...section.fields.map((f) => {
              const raw = a[f.key]
              return {
                key: f.key,
                label: f.label,
                wide: !!f.wide,
                filled: raw != null && raw !== '',
                value: f.kind === 'date' ? formatDate(raw) : raw || '—',
                sheet: f.sheet,
              }
            }),
          ].filter((it) => !hideEmpty || it.filled)
          if (hideEmpty && items.length === 0) return null
          return (
            <Card key={section.id} title={section.title} description={section.description}>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                {items.map((it) => (
                  <div key={it.key} className={clsx(it.wide && 'sm:col-span-2')}>
                    <dt className="text-xs font-medium tracking-wide text-ink-500 uppercase" title={'sheet' in it ? `Planilha: ${it.sheet}` : undefined}>
                      {it.label}
                    </dt>
                    <dd className={clsx('mt-1 text-sm break-words', it.filled ? 'text-ink-900' : 'text-ink-400', it.wide && 'whitespace-pre-line')}>
                      {it.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          )
        })}
      </div>
      <p className="text-xs text-ink-400">
        Cadastrada em {formatDateTimeLocal(a.createdAt)} · última alteração em {formatDateTimeLocal(a.updatedAt)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- Pendências

function PendenciesTab({
  amendment,
  pendencies,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  amendment: Amendment
  pendencies: AmendmentPendency[] | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  onOpen: () => void
}) {
  const { amendmentsAccess: access } = useAuth()
  const [resolving, setResolving] = useState<AmendmentPendency | null>(null)
  const canAct = access.canUpdate && !isClosed(amendment.status)

  if (loading) return <div className="card"><LoadingBlock /></div>
  if (error) return <div className="card"><ErrorState error={error} onRetry={onRetry} /></div>

  const open = (pendencies ?? []).filter((p) => p.open)
  const resolved = (pendencies ?? []).filter((p) => !p.open)

  return (
    <div className="space-y-5 animate-fade-in">
      <Card
        title="Abertas"
        description="Impedimentos e esperas que seguram a emenda."
        padded={false}
        actions={
          canAct && (
            <Button size="sm" variant="secondary" icon={<Hourglass className="size-3.5" />} onClick={onOpen}>
              Abrir pendência
            </Button>
          )
        }
      >
        {open.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="size-5" />} title="Nenhuma pendência aberta" description={isClosed(amendment.status) ? undefined : 'A emenda pode ser concluída.'} />
        ) : (
          <ul className="divide-y divide-ink-100">
            {open.map((p) => (
              <PendencyItem key={p.id} pendency={p} onResolve={canAct ? () => setResolving(p) : undefined} />
            ))}
          </ul>
        )}
      </Card>

      {resolved.length > 0 && (
        <Card title="Resolvidas" padded={false}>
          <ul className="divide-y divide-ink-100">
            {resolved.map((p) => (
              <PendencyItem key={p.id} pendency={p} />
            ))}
          </ul>
        </Card>
      )}

      {resolving && <ResolvePendencyModal pendency={resolving} onClose={() => setResolving(null)} />}
    </div>
  )
}

function PendencyItem({ pendency: p, onResolve }: { pendency: AmendmentPendency; onResolve?: () => void }) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <PendencyKindBadge kind={p.kind} />
          {p.waitingOn && <span className="text-xs text-ink-500">depende de <strong className="text-ink-700">{p.waitingOn}</strong></span>}
          <span className="text-xs text-ink-400">
            · {p.open ? `aberta há ${daysLabel(p.daysOpen)}` : `ficou aberta ${daysLabel(p.daysOpen)}`}
          </span>
        </div>
        <p className={clsx('mt-1.5 text-sm whitespace-pre-line', p.open ? 'text-ink-900' : 'text-ink-600')}>{p.description}</p>
        <p className="mt-1 text-xs text-ink-500">
          Aberta em {formatDateTimeLocal(p.openedAt)}
          {p.openedBy && ` por ${p.openedBy.name}`}
        </p>
        {!p.open && (
          <div className="mt-2 rounded-lg bg-emerald-50/70 px-3 py-2 text-sm">
            <p className="text-emerald-900 whitespace-pre-line">{p.resolution}</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Resolvida em {formatDateTimeLocal(p.resolvedAt)}
              {p.resolvedBy && ` por ${p.resolvedBy.name}`}
            </p>
          </div>
        )}
      </div>
      {onResolve && (
        <Button size="sm" icon={<CheckCircle2 className="size-3.5" />} onClick={onResolve}>
          Resolver
        </Button>
      )}
    </li>
  )
}

// ---------------------------------------------------------------- Linha do tempo

const ACTIVITY_ICON: Record<AmendmentActivityKind, typeof Flag> = {
  CREATED: FileEdit,
  FIELD_UPDATE: Pencil,
  NOTE: MessageSquarePlus,
  PENDENCY_OPENED: OctagonAlert,
  PENDENCY_RESOLVED: CheckCircle2,
  COMPLETED: Flag,
  REOPENED: RotateCcw,
  CANCELLED: Ban,
  IMPORTED: Import,
}

const ICON_STYLE: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-700',
  neutral: 'bg-ink-100 text-ink-500',
  warning: 'bg-amber-50 text-amber-700',
  success: 'bg-emerald-50 text-emerald-700',
  danger: 'bg-red-50 text-red-600',
}

function TimelineTab({ amendmentId }: { amendmentId: string }) {
  const timeline = useAmendmentTimeline(amendmentId)
  if (timeline.isPending) return <div className="card"><LoadingBlock /></div>
  if (timeline.isError) return <div className="card"><ErrorState error={timeline.error} onRetry={() => timeline.refetch()} /></div>
  const items = timeline.data
  if (items.length === 0) return <div className="card"><EmptyState title="Sem registros" /></div>

  return (
    <div className="card p-5 animate-fade-in">
      <ol className="relative space-y-5">
        <span className="absolute top-3 bottom-3 left-[15px] w-px bg-ink-200" aria-hidden />
        {items.map((it) => (
          <TimelineItem key={it.id} activity={it} />
        ))}
      </ol>
    </div>
  )
}

function TimelineItem({ activity: it }: { activity: AmendmentActivity }) {
  const Icon = ACTIVITY_ICON[it.kind] ?? NotebookPen
  const tone = ACTIVITY_KIND_TONE[it.kind] ?? 'neutral'
  const backdated = it.occurredAt.slice(0, 16) !== it.createdAt.slice(0, 16)
  return (
    <li className="relative flex gap-3">
      <span className={clsx('relative flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface', ICON_STYLE[tone])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-ink-900">{it.kindLabel}</span>
          <span className="text-xs text-ink-500 tabular-nums">{formatDateTimeLocal(it.occurredAt)}</span>
          {it.user && <span className="text-xs text-ink-500">· {it.user.name}</span>}
          {backdated && (
            <span className="text-[11px] text-ink-400" title="Data informada diferente do momento do registro">
              (registrado em {formatDateTimeLocal(it.createdAt)})
            </span>
          )}
        </p>
        {it.description && <p className="mt-1 text-sm whitespace-pre-line text-ink-700">{it.description}</p>}
        <AmendmentChanges changes={it.changes} />
      </div>
    </li>
  )
}
