import { useMemo } from 'react'
import { CalendarCheck2 } from 'lucide-react'
import { ApiError, type Trip } from '@/api'
import { useMyTrips } from '@/queries/fleet'
import { addDays, isSameDay, longDay, parseLocal, startOfDay, toDateKey } from '@/lib/fleet'
import { PageHeader } from '@/components/ui/Layout'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { TripCard } from '@/components/fleet/FleetUi'

/** Agenda do motorista vinculado ao usuário logado (não exige permissão em Frotas). */
export function MinhaAgendaPage() {
  const today = new Date()
  const trips = useMyTrips({ from: toDateKey(addDays(today, -7)), to: toDateKey(addDays(today, 30)) })

  const groups = useMemo(() => {
    const list = (trips.data ?? []).filter((t) => t.status !== 'CANCELLED')
    const now = Date.now()
    const current = list.filter((t) => t.status === 'IN_PROGRESS')
    const upcoming = list.filter((t) => t.status === 'SCHEDULED' && parseLocal(t.returnAt).getTime() >= startOfDay(today).getTime())
    const past = list.filter((t) => t.status === 'COMPLETED' || (t.status === 'SCHEDULED' && parseLocal(t.returnAt).getTime() < now - 86_400_000)).reverse()
    const byDay = new Map<string, Trip[]>()
    for (const t of upcoming) {
      const k = toDateKey(parseLocal(t.departureAt))
      byDay.set(k, [...(byDay.get(k) ?? []), t])
    }
    return { current, byDay, past }
  }, [trips.data])

  if (trips.isError && trips.error instanceof ApiError && trips.error.isNotFound) {
    return (
      <EmptyState
        icon={<CalendarCheck2 className="size-5" />}
        title="Seu usuário não está vinculado a um motorista"
        description="Peça à equipe de frotas para vincular seu usuário ao cadastro de motorista."
      />
    )
  }

  return (
    <>
      <PageHeader title="Minha agenda" description="Suas viagens como motorista: em andamento, próximas e recentes." />
      {trips.isPending ? (
        <div className="card">
          <LoadingBlock />
        </div>
      ) : trips.isError ? (
        <div className="card">
          <ErrorState error={trips.error} onRetry={() => trips.refetch()} />
        </div>
      ) : (
        <div className="space-y-8">
          {groups.current.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
                <span className="size-2 animate-pulse rounded-full bg-amber-500" /> Em andamento
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {groups.current.map((t) => (
                  <TripCard key={t.id} trip={t} showDriver={false} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Próximas viagens</h2>
            {groups.byDay.size === 0 ? (
              <div className="card">
                <EmptyState icon={<CalendarCheck2 className="size-5" />} title="Nenhuma viagem nos próximos 30 dias" />
              </div>
            ) : (
              <div className="space-y-5">
                {[...groups.byDay.entries()].map(([day, list]) => {
                  const d = parseLocal(day)
                  return (
                    <div key={day}>
                      <p className="mb-2 text-xs font-semibold tracking-wider text-ink-400 uppercase">
                        {isSameDay(d, today) ? 'Hoje' : isSameDay(d, addDays(today, 1)) ? 'Amanhã' : longDay(d)}
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        {list.map((t) => (
                          <TripCard key={t.id} trip={t} showDriver={false} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {groups.past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-ink-900">Últimos 7 dias</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {groups.past.map((t) => (
                  <TripCard key={t.id} trip={t} showDriver={false} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}
