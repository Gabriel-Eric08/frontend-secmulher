import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { Ban, CalendarClock, Car, CheckCircle2, CircleDot, Flag, Lock, MapPin, Pencil, Phone, Play, Route, UserRound } from 'lucide-react'
import type { Trip } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useTrip } from '@/queries/fleet'
import { PARTICIPANT_LABEL, formatDateTimeLocal, formatDuration, formatKm, formatTime, longDay, parseLocal } from '@/lib/fleet'
import { Card, PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageSkeleton } from '@/components/ui/Spinner'
import { Plate, TripStatusBadge } from '@/components/fleet/FleetUi'
import { TripLifecycleModal, type TripAction } from '@/components/fleet/TripLifecycleModals'

export function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { fleetAccess: access } = useAuth()
  const trip = useTrip(id)
  const [action, setAction] = useState<TripAction | null>(null)

  // Sem leitura em Frotas, o backend ainda libera a viagem para o motorista dela
  if (trip.isPending) return <PageSkeleton />
  if (trip.isError) return <ErrorState error={trip.error} onRetry={() => trip.refetch()} />

  const t = trip.data
  const scheduled = t.status === 'SCHEDULED'
  const canUpdate = access.canUpdate

  return (
    <>
      <PageHeader
        breadcrumbs={[
          ...(access.canRead ? [{ label: 'Frotas', to: '/frotas' }] : [{ label: 'Minha agenda', to: '/frotas/minha-agenda' }]),
          { label: `Viagem nº ${t.number}` },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.purpose}
            <TripStatusBadge status={t.status} />
          </span>
        }
        description={`Viagem nº ${t.number} · ${longDay(parseLocal(t.departureAt))}`}
        actions={
          canUpdate && (
            <>
              {scheduled && (
                <>
                  <Button variant="danger-ghost" icon={<Ban className="size-4" />} onClick={() => setAction('cancel')}>
                    Cancelar
                  </Button>
                  <ButtonLink to={`/frotas/viagens/${t.id}/editar`} variant="secondary" icon={<Pencil className="size-4" />}>
                    Editar
                  </ButtonLink>
                  <Button icon={<Play className="size-4" />} onClick={() => setAction('start')}>
                    Iniciar
                  </Button>
                </>
              )}
              {t.status === 'IN_PROGRESS' && (
                <Button icon={<Flag className="size-4" />} onClick={() => setAction('complete')}>
                  Concluir
                </Button>
              )}
            </>
          )
        }
      />

      {t.status === 'CANCELLED' && (
        <div className="mb-6 rounded-xl border border-ink-200 bg-ink-100/60 px-4 py-3 text-sm animate-fade-down">
          <p className="font-medium text-ink-800">Cancelada em {formatDateTimeLocal(t.cancelledAt)}</p>
          {t.cancellationReason && <p className="mt-0.5 whitespace-pre-line text-ink-600">{t.cancellationReason}</p>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <RouteCard trip={t} />

          <Card title="Participantes" description={`${t.participantCount} de ${t.vehicle.capacity} lugares`} padded={false}>
            {t.participants.length === 0 ? (
              <EmptyState title="Sem participantes" description="Só o motorista nesta viagem." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {t.participants.map((p) => (
                  <li key={p.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
                      {p.hidden ? <Lock className="size-4" /> : <UserRound className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className={clsx('font-medium', p.hidden ? 'text-ink-400' : 'text-ink-900')}>
                          {p.hidden ? 'Atendida (sigilo)' : p.name}
                        </span>
                        <Badge tone={p.type === 'CLIENT' ? 'warning' : p.type === 'USER' ? 'brand' : 'neutral'}>
                          {PARTICIPANT_LABEL[p.type]}
                        </Badge>
                      </p>
                      {!p.hidden && (p.phone || p.document || p.notes) && (
                        <p className="mt-0.5 text-xs text-ink-500">{[p.phone, p.document, p.notes].filter(Boolean).join(' · ')}</p>
                      )}
                      {p.type === 'CLIENT' && !p.hidden && p.clientId && (
                        <Link to={`/mulheres/${p.clientId}`} className="text-xs font-medium text-brand-700 hover:underline">
                          Ver cadastro
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {t.description && (
            <Card title="Descrição">
              <p className="text-sm whitespace-pre-line text-ink-700">{t.description}</p>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card title="Escala">
            <div className="space-y-4">
              <Link
                to={access.canRead ? `/frotas/motoristas/${t.driver.id}` : '#'}
                className="group flex items-center gap-3 rounded-lg p-1 -m-1 transition-colors hover:bg-ink-50"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <UserRound className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-ink-500">Motorista</span>
                  <span className="block truncate font-medium text-ink-900 group-hover:text-brand-700">{t.driver.name}</span>
                  {t.driver.phone && (
                    <span className="flex items-center gap-1 text-xs text-ink-500">
                      <Phone className="size-3" /> {t.driver.phone}
                    </span>
                  )}
                </span>
              </Link>
              <Link
                to={access.canRead ? `/frotas/veiculos/${t.vehicle.id}` : '#'}
                className="group flex items-center gap-3 rounded-lg p-1 -m-1 transition-colors hover:bg-ink-50"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Car className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-ink-500">Veículo</span>
                  <span className="block truncate font-medium text-ink-900 group-hover:text-brand-700">
                    {[t.vehicle.brand, t.vehicle.model].filter(Boolean).join(' ')}
                  </span>
                  <span className="text-xs text-ink-500">{t.vehicle.capacity} passageiro(s)</span>
                </span>
                <Plate plate={t.vehicle.plate} size="sm" />
              </Link>
            </div>
          </Card>

          <Card title="Histórico">
            <Lifecycle trip={t} />
          </Card>
        </aside>
      </div>

      {action && <TripLifecycleModal trip={t} action={action} onClose={() => setAction(null)} />}
    </>
  )
}

/** Partida → destino com horários previstos e reais. */
function RouteCard({ trip: t }: { trip: Trip }) {
  return (
    <section className="card overflow-hidden">
      <div className="grid gap-0 sm:grid-cols-[1fr_auto_1fr]">
        <RouteStop
          title="Partida"
          icon={<CircleDot className="size-3.5 text-brand-600" />}
          place={t.departureLocation}
          plannedLabel="Ida prevista"
          planned={t.departureAt}
          actual={t.actualDepartureAt}
        />
        {/* conector entre as duas pontas, com a duração prevista */}
        <div className="hidden items-center sm:flex">
          <div className="flex flex-col items-center gap-1 px-2 text-xs text-ink-400">
            <span className="h-px w-16 bg-gradient-to-r from-transparent via-ink-300 to-transparent" />
            <span className="tabular-nums">{formatDuration(t.departureAt, t.returnAt)}</span>
          </div>
        </div>
        <RouteStop
          title="Destino"
          icon={<MapPin className="size-3.5 text-brand-600" />}
          place={t.destination}
          plannedLabel="Volta prevista"
          planned={t.returnAt}
          actual={t.actualReturnAt}
          alignRight
        />
      </div>
      {(t.startOdometerKm != null || t.distanceKm != null) && (
        <div className="grid grid-cols-3 border-t border-ink-100 bg-ink-50/60 text-center">
          <Stat label="Km saída" value={formatKm(t.startOdometerKm)} />
          <Stat label="Km chegada" value={formatKm(t.endOdometerKm)} />
          <Stat label="Distância" value={formatKm(t.distanceKm)} icon={<Route className="size-3.5" />} strong />
        </div>
      )}
      {t.completionNotes && (
        <div className="border-t border-ink-100 px-5 py-3 text-sm">
          <p className="text-xs font-medium text-ink-500">Observações da conclusão</p>
          <p className="mt-0.5 whitespace-pre-line text-ink-700">{t.completionNotes}</p>
        </div>
      )}
    </section>
  )
}

function RouteStop({
  title,
  icon,
  place,
  plannedLabel,
  planned,
  actual,
  alignRight,
}: {
  title: string
  icon: React.ReactNode
  place: string
  plannedLabel: string
  planned: string
  actual: string | null
  alignRight?: boolean
}) {
  return (
    <div className={clsx('p-5', alignRight && 'sm:text-right')}>
      <p className={clsx('flex items-center gap-1.5 text-xs font-medium text-ink-500', alignRight && 'sm:justify-end')}>
        {icon}
        {title}
      </p>
      <p className="mt-1 text-lg font-semibold text-ink-900">{place}</p>
      <p className="mt-2 text-sm text-ink-600 tabular-nums">
        {plannedLabel} <strong className="text-ink-900">{formatTime(planned)}</strong>
        <span className="text-ink-400"> · {formatDateTimeLocal(planned).slice(0, 10)}</span>
      </p>
      {actual && <p className="text-xs text-emerald-700 tabular-nums">Real: {formatDateTimeLocal(actual)}</p>}
    </div>
  )
}

function Stat({ label, value, icon, strong }: { label: string; value: string; icon?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="px-3 py-3">
      <p className="flex items-center justify-center gap-1 text-[11px] text-ink-500">
        {icon}
        {label}
      </p>
      <p className={clsx('mt-0.5 tabular-nums', strong ? 'font-semibold text-brand-700' : 'text-ink-900')}>{value}</p>
    </div>
  )
}

/** Linha do tempo: agendada → iniciada → concluída/cancelada. */
function Lifecycle({ trip: t }: { trip: Trip }) {
  const steps = [
    { done: true, icon: CalendarClock, label: 'Agendada', when: t.createdAt },
    ...(t.status === 'CANCELLED'
      ? [{ done: true, icon: Ban, label: 'Cancelada', when: t.cancelledAt, danger: true }]
      : [
          { done: !!t.actualDepartureAt, icon: Play, label: 'Iniciada', when: t.actualDepartureAt },
          { done: !!t.actualReturnAt, icon: CheckCircle2, label: 'Concluída', when: t.actualReturnAt },
        ]),
  ] as { done: boolean; icon: typeof Play; label: string; when: string | null; danger?: boolean }[]
  return (
    <ol className="relative space-y-4">
      <span className="absolute top-2 bottom-2 left-[13px] w-px bg-ink-200" aria-hidden />
      {steps.map((s) => (
        <li key={s.label} className="relative flex items-center gap-3">
          <span
            className={clsx(
              'relative flex size-7 items-center justify-center rounded-full ring-4 ring-surface',
              s.danger ? 'bg-red-50 text-red-600' : s.done ? 'bg-accent text-white' : 'bg-ink-100 text-ink-400',
            )}
          >
            <s.icon className="size-3.5" />
          </span>
          <span>
            <span className={clsx('block text-sm', s.done ? 'font-medium text-ink-900' : 'text-ink-400')}>{s.label}</span>
            <span className="block text-xs text-ink-500 tabular-nums">{s.when ? formatDateTimeLocal(s.when) : 'Pendente'}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
