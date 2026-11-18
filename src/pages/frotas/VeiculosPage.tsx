import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { CarFront, Gauge, Plus, Users } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useTrips, useVehicles } from '@/queries/fleet'
import { addDays, formatKm, toDateKey } from '@/lib/fleet'
import { normalize } from '@/lib/format'
import { PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchInput, Switch } from '@/components/ui/Form'
import { EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { Plate } from '@/components/fleet/FleetUi'
import { VehicleFormModal } from '@/components/fleet/FleetFormModals'

export function VeiculosPage() {
  const { fleetAccess: access } = useAuth()
  const vehicles = useVehicles(access.canRead)
  const today = new Date()
  const trips = useTrips({ from: toDateKey(today), to: toDateKey(addDays(today, 7)) }, access.canRead)
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [creating, setCreating] = useState(false)

  const usage = useMemo(() => {
    const inUse = new Set<string>()
    const upcoming = new Map<string, number>()
    for (const t of trips.data ?? []) {
      if (t.status === 'IN_PROGRESS') inUse.add(t.vehicle.id)
      if (t.status === 'SCHEDULED') upcoming.set(t.vehicle.id, (upcoming.get(t.vehicle.id) ?? 0) + 1)
    }
    return { inUse, upcoming }
  }, [trips.data])

  const list = useMemo(() => {
    let l = vehicles.data ?? []
    if (!showInactive) l = l.filter((v) => v.isActive)
    if (q.trim()) {
      const n = normalize(q.trim())
      l = l.filter((v) => normalize(`${v.plate} ${v.brand ?? ''} ${v.model} ${v.color ?? ''}`).includes(n))
    }
    return l
  }, [vehicles.data, q, showInactive])

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de frotas." />
  const inactiveCount = (vehicles.data ?? []).filter((v) => !v.isActive).length

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Frotas', to: '/frotas' }, { label: 'Veículos' }]}
        title="Veículos"
        description="Frota disponível, capacidade e quilometragem."
        actions={
          access.canCreate && (
            <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Novo veículo
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput className="sm:w-80" placeholder="Buscar por placa, marca ou modelo…" value={q} onChange={(e) => setQ(e.target.value)} />
        {inactiveCount > 0 && <Switch checked={showInactive} onChange={setShowInactive} label={`Inativos (${inactiveCount})`} />}
      </div>

      {vehicles.isPending ? (
        <div className="card">
          <LoadingBlock />
        </div>
      ) : vehicles.isError ? (
        <div className="card">
          <ErrorState error={vehicles.error} onRetry={() => vehicles.refetch()} />
        </div>
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CarFront className="size-5" />}
            title={q ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado'}
            action={
              !q &&
              access.canCreate && (
                <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                  Novo veículo
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((v, i) => {
            const inUse = usage.inUse.has(v.id)
            const next = usage.upcoming.get(v.id) ?? 0
            return (
              <li key={v.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <Link to={`/frotas/veiculos/${v.id}`} className={clsx('card card-interactive flex h-full flex-col p-5', !v.isActive && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">{[v.brand, v.model].filter(Boolean).join(' ')}</p>
                      <p className="text-xs text-ink-500">{[v.year, v.color].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <Plate plate={v.plate} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5 text-ink-400" /> {v.capacity} passageiro(s)
                    </span>
                    <span className="flex items-center gap-1.5 tabular-nums">
                      <Gauge className="size-3.5 text-ink-400" /> {formatKm(v.odometerKm)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t border-ink-100 pt-3">
                    {!v.isActive ? (
                      <Badge>Inativo</Badge>
                    ) : inUse ? (
                      <Badge tone="warning">Em uso agora</Badge>
                    ) : (
                      <Badge tone="success">Disponível</Badge>
                    )}
                    <span className="text-xs text-ink-400">
                      {next ? `${next} viagem(ns) nos próximos 7 dias` : 'Sem viagens nos próximos 7 dias'}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <VehicleFormModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
