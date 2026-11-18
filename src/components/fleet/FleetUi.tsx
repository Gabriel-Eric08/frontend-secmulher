import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react'
import type { Trip, TripStatus } from '@/api'
import {
  TRIP_STATUS_ACCENT,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_TONE,
  formatPeriod,
  formatPlate,
  licenseState,
  weekLabel,
} from '@/lib/fleet'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <Badge
      tone={TRIP_STATUS_TONE[status]}
      icon={
        status === 'IN_PROGRESS' ? (
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
          </span>
        ) : undefined
      }
    >
      {TRIP_STATUS_LABEL[status]}
    </Badge>
  )
}

/** Placa no estilo Mercosul (faixa azul + caracteres). Fica clara também no tema escuro, como a placa real. */
export function Plate({ plate, size = 'md' }: { plate: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={clsx(
        'inline-flex flex-col overflow-hidden rounded-[5px] border border-ink-900/70 bg-white text-center leading-none shadow-sm',
        { sm: 'w-[4.6rem]', md: 'w-[5.6rem]', lg: 'w-32' }[size],
      )}
      title={`Placa ${formatPlate(plate)}`}
    >
      <span className={clsx('bg-[#1f4aa8] font-semibold tracking-widest text-white', size === 'lg' ? 'py-0.5 text-[8px]' : 'text-[6px] py-px')}>
        BRASIL
      </span>
      <span
        className={clsx(
          'font-mono font-bold tracking-wider text-[#111]',
          { sm: 'py-0.5 text-[11px]', md: 'py-1 text-[13px]', lg: 'py-1.5 text-lg' }[size],
        )}
      >
        {formatPlate(plate)}
      </span>
    </span>
  )
}

export function LicenseBadge({ expiry }: { expiry: string }) {
  const s = licenseState(expiry)
  return <Badge tone={s.tone}>{s.label}</Badge>
}

/** Cartão compacto de viagem para a agenda. */
export function TripCard({ trip, compact, showDriver = true }: { trip: Trip; compact?: boolean; showDriver?: boolean }) {
  const cancelled = trip.status === 'CANCELLED'
  return (
    <Link
      to={`/frotas/viagens/${trip.id}`}
      className={clsx(
        'group block rounded-lg border border-l-[3px] border-ink-200 bg-surface transition-all duration-150 hover:-translate-y-px hover:border-brand-300 hover:shadow-(--shadow-glow)',
        TRIP_STATUS_ACCENT[trip.status],
        compact ? 'px-2.5 py-2' : 'px-3.5 py-3',
        cancelled && 'opacity-60',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-ink-500 tabular-nums">{formatPeriod(trip.departureAt, trip.returnAt)}</span>
        {!compact && <TripStatusBadge status={trip.status} />}
        {compact && trip.status === 'IN_PROGRESS' && <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />}
      </div>
      <p className={clsx('mt-1 font-medium text-ink-900 group-hover:text-brand-800', compact ? 'line-clamp-2 text-xs' : 'text-sm', cancelled && 'line-through')}>
        {trip.purpose}
      </p>
      <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-ink-500">
        <MapPin className="size-3 shrink-0" />
        <span className="truncate">{trip.destination}</span>
      </p>
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
          {showDriver && <span className="truncate">{trip.driver.name}</span>}
          <span className="font-mono">{formatPlate(trip.vehicle.plate)}</span>
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {trip.participantCount}/{trip.vehicle.capacity}
          </span>
        </div>
      )}
      {compact && showDriver && <p className="mt-1 truncate text-[11px] text-ink-400">{trip.driver.name.split(' ')[0]}</p>}
    </Link>
  )
}

/** Navegação de semana: ‹ hoje › e o intervalo. */
export function WeekNav({ start, onChange }: { start: Date; onChange: (d: Date) => void }) {
  const shift = (days: number) => {
    const d = new Date(start)
    d.setDate(d.getDate() + days)
    onChange(d)
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-ink-300 bg-surface">
        <button
          onClick={() => shift(-7)}
          className="flex size-9 items-center justify-center rounded-l-lg text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="flex items-center gap-2 border-x border-ink-200 px-3 text-sm font-medium whitespace-nowrap text-ink-800 tabular-nums">
          <CalendarDays className="size-4 text-brand-600" />
          {weekLabel(start)}
        </span>
        <button
          onClick={() => shift(7)}
          className="flex size-9 items-center justify-center rounded-r-lg text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
          aria-label="Próxima semana"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <Button variant="secondary" size="sm" className="h-9" onClick={() => onChange(new Date())}>
        Hoje
      </Button>
    </div>
  )
}
