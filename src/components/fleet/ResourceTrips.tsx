import { useState } from 'react'
import { Route } from 'lucide-react'
import type { Trip } from '@/api'
import { useTrips } from '@/queries/fleet'
import { addDays, formatKm, parseLocal, toDateKey } from '@/lib/fleet'
import { Tabs } from '@/components/ui/Layout'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { TripCard } from './FleetUi'

/**
 * Viagens de um motorista ou veículo: próximas (hoje em diante, 60 dias) e
 * histórico (últimos 90 dias), com km rodados no período.
 */
export function ResourceTrips({ driverId, vehicleId }: { driverId?: string; vehicleId?: string }) {
  const [tab, setTab] = useState<'proximas' | 'historico'>('proximas')
  const today = new Date()
  const upcoming = useTrips({ driverId, vehicleId, from: toDateKey(today), to: toDateKey(addDays(today, 60)) }, tab === 'proximas')
  const history = useTrips({ driverId, vehicleId, from: toDateKey(addDays(today, -90)), to: toDateKey(today) }, tab === 'historico')

  const q = tab === 'proximas' ? upcoming : history
  const now = Date.now()
  const list: Trip[] =
    tab === 'proximas'
      ? (upcoming.data ?? []).filter((t) => t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS')
      : (history.data ?? [])
          .filter((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED' || parseLocal(t.returnAt).getTime() < now)
          .reverse()
  const km = (history.data ?? []).reduce((s, t) => s + (t.distanceKm ?? 0), 0)

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 px-5 pt-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'proximas', label: 'Próximas viagens' },
            { value: 'historico', label: 'Histórico (90 dias)' },
          ]}
        />
        {tab === 'historico' && history.isSuccess && (
          <span className="hidden items-center gap-1.5 text-xs text-ink-500 sm:flex">
            <Route className="size-3.5" /> {formatKm(km)} rodados
          </span>
        )}
      </div>
      {q.isPending ? (
        <LoadingBlock rows={3} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title={tab === 'proximas' ? 'Nenhuma viagem agendada' : 'Nenhuma viagem no período'} />
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {list.map((t) => (
            <TripCard key={t.id} trip={t} showDriver={!driverId} />
          ))}
        </div>
      )}
    </section>
  )
}
