import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarRange, CarFront, LayoutList, Plus, Route, Timer, UsersRound } from 'lucide-react'
import type { Driver, Trip, TripStatus } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { FLEET_TABLE } from '@/auth/access'
import { useCategories } from '@/queries/admin'
import { useDrivers, useTrips, useVehicles } from '@/queries/fleet'
import {
  TRIP_STATUS_LABEL,
  addDays,
  dayMonth,
  formatKm,
  formatPeriod,
  formatPlate,
  isSameDay,
  licenseState,
  longDay,
  parseLocal,
  startOfWeek,
  toDateKey,
  tripTouchesDay,
  weekdayShort,
} from '@/lib/fleet'
import { PageHeader, StatCard } from '@/components/ui/Layout'
import { ButtonLink } from '@/components/ui/Button'
import { Select, Switch } from '@/components/ui/Form'
import { Alert, EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { TripCard, WeekNav } from '@/components/fleet/FleetUi'

type View = 'semana' | 'motoristas' | 'lista'
const STATUSES: TripStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

export function AgendaPage() {
  const { fleetAccess: access, isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const categories = useCategories()

  // Estado na URL: semana, visão e filtros sobrevivem à navegação e podem ser compartilhados
  const weekStart = startOfWeek(params.get('semana') ? parseLocal(params.get('semana')!) : new Date())
  const view = (params.get('visao') as View) || 'semana'
  const driverId = params.get('motorista') ?? ''
  const vehicleId = params.get('veiculo') ?? ''
  const status = (params.get('situacao') as TripStatus) || undefined
  const showCancelled = params.get('canceladas') === '1'

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const trips = useTrips(
    {
      from: toDateKey(weekStart),
      to: toDateKey(addDays(weekStart, 6)),
      driverId: driverId || undefined,
      vehicleId: vehicleId || undefined,
      status,
    },
    access.canRead,
  )
  const drivers = useDrivers(access.canRead)
  const vehicles = useVehicles(access.canRead)

  const visible = useMemo(
    () => (trips.data ?? []).filter((t) => showCancelled || status === 'CANCELLED' || t.status !== 'CANCELLED'),
    [trips.data, showCancelled, status],
  )

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de frotas." />

  const hasCategory = (categories.data ?? []).some((c) => c.entityType === 'native' && c.tableReference === FLEET_TABLE)
  const all = trips.data ?? []
  const today = new Date()
  const stats = {
    today: all.filter((t) => t.status !== 'CANCELLED' && tripTouchesDay(t, today)).length,
    inProgress: all.filter((t) => t.status === 'IN_PROGRESS').length,
    scheduled: all.filter((t) => t.status === 'SCHEDULED').length,
    km: all.reduce((s, t) => s + (t.distanceKm ?? 0), 0),
  }

  return (
    <>
      <PageHeader
        title="Frotas"
        description="Agenda de viagens, motoristas e veículos."
        actions={
          <>
            <WeekNav start={weekStart} onChange={(d) => setParam('semana', isSameDay(startOfWeek(d), startOfWeek(new Date())) ? '' : toDateKey(startOfWeek(d)))} />
            {access.canCreate && (
              <ButtonLink to="/frotas/viagens/nova" icon={<Plus className="size-4" />}>
                Nova viagem
              </ButtonLink>
            )}
          </>
        }
      />

      {isAdmin && categories.isSuccess && !hasCategory && (
        <div className="mb-6">
          <Alert
            tone="warning"
            title="Categoria de frotas não configurada"
            action={
              <ButtonLink to="/admin/categorias?setup=frotas" size="sm" variant="secondary">
                Configurar agora
              </ButtonLink>
            }
          >
            Sem ela, apenas administradoras acessam Frotas. Crie a categoria nativa para conceder permissões à equipe.
          </Alert>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Viagens hoje" value={trips.isPending ? '…' : stats.today} icon={<CalendarRange className="size-5" />} />
        <StatCard label="Em andamento" value={trips.isPending ? '…' : stats.inProgress} icon={<Timer className="size-5" />} />
        <StatCard label="Agendadas na semana" value={trips.isPending ? '…' : stats.scheduled} icon={<CarFront className="size-5" />} />
        <StatCard label="Km rodados na semana" value={trips.isPending ? '…' : formatKm(stats.km)} icon={<Route className="size-5" />} />
      </div>

      <div className="card">
        {/* Barra de visões e filtros */}
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1 lg:w-auto" role="tablist">
            {(
              [
                { v: 'semana', label: 'Semana', icon: CalendarRange },
                { v: 'motoristas', label: 'Motoristas', icon: UsersRound },
                { v: 'lista', label: 'Lista', icon: LayoutList },
              ] as const
            ).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setParam('visao', v === 'semana' ? '' : v)}
                className={clsx(
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all',
                  view === v ? 'bg-surface font-medium text-brand-800 shadow-sm' : 'text-ink-500 hover:text-ink-800',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Select className="sm:w-48" value={driverId} onChange={(e) => setParam('motorista', e.target.value)} aria-label="Motorista">
              <option value="">Todos os motoristas</option>
              {(drivers.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select className="sm:w-44" value={vehicleId} onChange={(e) => setParam('veiculo', e.target.value)} aria-label="Veículo">
              <option value="">Todos os veículos</option>
              {(vehicles.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {formatPlate(v.plate)} · {v.model}
                </option>
              ))}
            </Select>
            <Select className="sm:w-40" value={status ?? ''} onChange={(e) => setParam('situacao', e.target.value)} aria-label="Situação">
              <option value="">Todas as situações</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TRIP_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            {!status && <Switch checked={showCancelled} onChange={(v) => setParam('canceladas', v ? '1' : '')} label="Canceladas" />}
          </div>
        </div>

        <div className={clsx('transition-opacity duration-200', trips.isFetching && trips.isPlaceholderData && 'opacity-60')}>
          {trips.isPending ? (
            <LoadingBlock />
          ) : trips.isError ? (
            <ErrorState error={trips.error} onRetry={() => trips.refetch()} />
          ) : view === 'semana' ? (
            <WeekBoard days={days} trips={visible} canCreate={access.canCreate} />
          ) : view === 'motoristas' ? (
            <DriverBoard days={days} trips={visible} drivers={drivers.data ?? []} canCreate={access.canCreate} onlyDriver={driverId} />
          ) : visible.length === 0 ? (
            <EmptyState title="Nenhuma viagem nesta semana" description="Use “Nova viagem” para agendar." />
          ) : (
            <TripList days={days} trips={visible} />
          )}
        </div>
      </div>
    </>
  )
}

/** Colunas por dia (lista empilhada no celular). */
function WeekBoard({ days, trips, canCreate }: { days: Date[]; trips: Trip[]; canCreate: boolean }) {
  const today = new Date()
  return (
    <div className="grid divide-y divide-ink-100 lg:grid-cols-7 lg:divide-x lg:divide-y-0">
      {days.map((d) => {
        const dayTrips = trips.filter((t) => tripTouchesDay(t, d))
        const isToday = isSameDay(d, today)
        return (
          <div key={toDateKey(d)} className={clsx('group/day flex min-h-40 flex-col lg:min-h-[26rem]', isToday && 'bg-brand-50/40')}>
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <div className="flex items-baseline gap-1.5">
                <span className={clsx('text-xs font-medium uppercase', isToday ? 'text-brand-700' : 'text-ink-400')}>{weekdayShort(d)}</span>
                <span
                  className={clsx(
                    'flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                    isToday ? 'bg-accent text-white' : 'text-ink-800',
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
              {canCreate && (
                <Link
                  to={`/frotas/viagens/nova?data=${toDateKey(d)}`}
                  className="flex size-7 items-center justify-center rounded-full text-ink-400 opacity-100 transition-all hover:bg-brand-100 hover:text-brand-700 lg:opacity-0 lg:group-hover/day:opacity-100"
                  aria-label={`Nova viagem em ${dayMonth(d)}`}
                  title="Agendar neste dia"
                >
                  <Plus className="size-4" />
                </Link>
              )}
            </div>
            <div className="flex-1 space-y-2 px-2 pb-3">
              {dayTrips.length === 0 ? (
                <p className="px-1 text-xs text-ink-300 lg:pt-2 lg:text-center">Livre</p>
              ) : (
                dayTrips.map((t) => <TripCard key={t.id} trip={t} compact />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Quadro motoristas × dias: mostra de relance quem está ocupado e quando. */
function DriverBoard({
  days,
  trips,
  drivers,
  canCreate,
  onlyDriver,
}: {
  days: Date[]
  trips: Trip[]
  drivers: Driver[]
  canCreate: boolean
  onlyDriver: string
}) {
  const today = new Date()
  const withTrips = new Set(trips.map((t) => t.driver.id))
  const rows = drivers
    .filter((d) => (onlyDriver ? d.id === onlyDriver : d.isActive || withTrips.has(d.id)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  if (rows.length === 0) return <EmptyState title="Nenhum motorista cadastrado" />

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-52 border-b border-ink-200 bg-ink-50 px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase">
              Motorista
            </th>
            {days.map((d) => (
              <th
                key={toDateKey(d)}
                className={clsx(
                  'border-b border-l border-ink-200 px-2 py-2 text-center text-xs font-medium',
                  isSameDay(d, today) ? 'bg-brand-50 text-brand-800' : 'bg-ink-50 text-ink-500',
                )}
              >
                <span className="uppercase">{weekdayShort(d)}</span> <span className="tabular-nums">{d.getDate()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((driver) => {
            const lic = licenseState(driver.licenseExpiry)
            return (
              <tr key={driver.id} className="group/row">
                <td className="sticky left-0 z-10 border-b border-ink-100 bg-surface px-4 py-2 transition-colors group-hover/row:bg-ink-50">
                  <Link to={`/frotas/motoristas/${driver.id}`} className="block min-w-0 hover:text-brand-700">
                    <span className="block truncate font-medium text-ink-900">{driver.name}</span>
                    <span className={clsx('block text-[11px]', lic.tone === 'success' ? 'text-ink-400' : lic.tone === 'danger' ? 'text-red-600' : 'text-amber-700')}>
                      {!driver.isActive ? 'Inativo' : lic.tone === 'success' ? `CNH ${driver.licenseCategory}` : lic.label}
                    </span>
                  </Link>
                </td>
                {days.map((d) => {
                  const cell = trips.filter((t) => t.driver.id === driver.id && tripTouchesDay(t, d))
                  return (
                    <td
                      key={toDateKey(d)}
                      className={clsx('group/cell relative h-16 border-b border-l border-ink-100 p-1 align-top', isSameDay(d, today) && 'bg-brand-50/30')}
                    >
                      <div className="space-y-1">
                        {cell.map((t) => (
                          <Link
                            key={t.id}
                            to={`/frotas/viagens/${t.id}`}
                            title={`${t.purpose} · ${formatPeriod(t.departureAt, t.returnAt)} · ${t.destination}`}
                            className={clsx(
                              'block truncate rounded-md px-1.5 py-1 text-[11px] font-medium transition-all hover:brightness-95 hover:ring-2 hover:ring-brand-300',
                              {
                                SCHEDULED: 'bg-brand-100 text-brand-800',
                                IN_PROGRESS: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
                                COMPLETED: 'bg-emerald-50 text-emerald-700',
                                CANCELLED: 'bg-ink-100 text-ink-400 line-through',
                              }[t.status],
                            )}
                          >
                            {formatPeriod(t.departureAt, t.returnAt).split(' – ')[0]} {t.destination}
                          </Link>
                        ))}
                      </div>
                      {canCreate && driver.isActive && cell.length === 0 && (
                        <Link
                          to={`/frotas/viagens/nova?data=${toDateKey(d)}&motorista=${driver.id}`}
                          className="absolute inset-1 flex items-center justify-center rounded-md border border-dashed border-transparent text-ink-300 opacity-0 transition-all group-hover/cell:border-brand-300 group-hover/cell:text-brand-600 group-hover/cell:opacity-100"
                          aria-label={`Agendar ${driver.name} em ${dayMonth(d)}`}
                        >
                          <Plus className="size-4" />
                        </Link>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Lista agrupada por dia de saída. */
function TripList({ days, trips }: { days: Date[]; trips: Trip[] }) {
  return (
    <div className="divide-y divide-ink-100">
      {days.map((d, i) => {
        // viagens que saíram antes desta semana (e ainda a ocupam) entram no primeiro dia
        const dayTrips = trips.filter((t) => {
          const dep = parseLocal(t.departureAt)
          return isSameDay(dep, d) || (i === 0 && dep < days[0])
        })
        if (dayTrips.length === 0) return null
        return (
          <section key={toDateKey(d)} className="px-4 py-4 sm:px-5">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-ink-400 uppercase">{longDay(d)}</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dayTrips.map((t) => (
                <TripCard key={t.id} trip={t} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
