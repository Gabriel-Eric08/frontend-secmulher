import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { IdCard, Link2, Phone, Plus, UserRound } from 'lucide-react'
import type { Trip } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useDrivers, useTrips } from '@/queries/fleet'
import { addDays, daysUntil, formatPeriod, licenseState, longDay, parseLocal, toDateKey } from '@/lib/fleet'
import { normalize } from '@/lib/format'
import { Avatar, PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchInput, Switch } from '@/components/ui/Form'
import { Alert, EmptyState, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { LicenseBadge } from '@/components/fleet/FleetUi'
import { DriverFormModal } from '@/components/fleet/FleetFormModals'

export function MotoristasPage() {
  const { fleetAccess: access } = useAuth()
  const drivers = useDrivers(access.canRead)
  const today = new Date()
  // Próximos 30 dias: "em viagem agora" e próxima viagem de cada motorista
  const trips = useTrips({ from: toDateKey(today), to: toDateKey(addDays(today, 30)) }, access.canRead)
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [creating, setCreating] = useState(false)

  const nextByDriver = useMemo(() => {
    const map = new Map<string, { current?: Trip; next?: Trip }>()
    const now = Date.now()
    for (const t of trips.data ?? []) {
      if (t.status === 'CANCELLED' || t.status === 'COMPLETED') continue
      const entry = map.get(t.driver.id) ?? {}
      if (t.status === 'IN_PROGRESS') entry.current = t
      else if (!entry.next && parseLocal(t.departureAt).getTime() >= now - 3600_000) entry.next = t
      map.set(t.driver.id, entry)
    }
    return map
  }, [trips.data])

  const list = useMemo(() => {
    let l = drivers.data ?? []
    if (!showInactive) l = l.filter((d) => d.isActive)
    if (q.trim()) {
      const n = normalize(q.trim())
      l = l.filter((d) => normalize(`${d.name} ${d.licenseNumber} ${d.phone ?? ''}`).includes(n))
    }
    return l
  }, [drivers.data, q, showInactive])

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de frotas." />

  const active = (drivers.data ?? []).filter((d) => d.isActive)
  const expired = active.filter((d) => daysUntil(d.licenseExpiry) < 0).length
  const expiring = active.filter((d) => {
    const n = daysUntil(d.licenseExpiry)
    return n >= 0 && n <= 30
  }).length
  const inactiveCount = (drivers.data ?? []).length - active.length

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Frotas', to: '/frotas' }, { label: 'Motoristas' }]}
        title="Motoristas"
        description="Habilitação, vínculo com usuários e agenda de cada motorista."
        actions={
          access.canCreate && (
            <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Novo motorista
            </Button>
          )
        }
      />

      {(expired > 0 || expiring > 0) && (
        <div className="mb-6">
          <Alert tone={expired ? 'danger' : 'warning'} title="Atenção às habilitações">
            {expired > 0 && `${expired} motorista(s) com CNH vencida não pode(m) ser escalado(s). `}
            {expiring > 0 && `${expiring} CNH vence(m) nos próximos 30 dias.`}
          </Alert>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput className="sm:w-80" placeholder="Buscar por nome, CNH ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} />
        {inactiveCount > 0 && <Switch checked={showInactive} onChange={setShowInactive} label={`Inativos (${inactiveCount})`} />}
      </div>

      {drivers.isPending ? (
        <div className="card">
          <LoadingBlock />
        </div>
      ) : drivers.isError ? (
        <div className="card">
          <ErrorState error={drivers.error} onRetry={() => drivers.refetch()} />
        </div>
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<UserRound className="size-5" />}
            title={q ? 'Nenhum motorista encontrado' : 'Nenhum motorista cadastrado'}
            action={
              !q &&
              access.canCreate && (
                <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                  Novo motorista
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d, i) => {
            const status = nextByDriver.get(d.id)
            const lic = licenseState(d.licenseExpiry)
            return (
              <li key={d.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <Link to={`/frotas/motoristas/${d.id}`} className={clsx('card card-interactive flex h-full flex-col p-5', !d.isActive && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <Avatar name={d.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900">{d.name}</p>
                      <p className="flex items-center gap-1 text-xs text-ink-500">
                        {d.phone ? (
                          <>
                            <Phone className="size-3" /> {d.phone}
                          </>
                        ) : (
                          'Sem telefone'
                        )}
                      </p>
                    </div>
                    {status?.current ? (
                      <Badge tone="warning">Em viagem</Badge>
                    ) : !d.isActive ? (
                      <Badge>Inativo</Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-2 py-1 font-mono text-xs text-ink-700">
                      <IdCard className="size-3.5 text-ink-400" />
                      {d.licenseCategory}
                    </span>
                    {lic.tone !== 'success' ? <LicenseBadge expiry={d.licenseExpiry} /> : null}
                    {d.userName && (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-500" title="Usuário vinculado">
                        <Link2 className="size-3" /> {d.userName}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 border-t border-ink-100 pt-3 text-xs">
                    {status?.current ? (
                      <p className="truncate text-amber-700">
                        Agora: {status.current.destination}
                      </p>
                    ) : status?.next ? (
                      <p className="truncate text-ink-500">
                        Próxima: <span className="text-ink-800">{longDay(parseLocal(status.next.departureAt)).split(',')[0]}</span>,{' '}
                        {formatPeriod(status.next.departureAt, status.next.returnAt)} · {status.next.destination}
                      </p>
                    ) : (
                      <p className="text-ink-400">Sem viagens nos próximos 30 dias</p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <DriverFormModal open={creating} onClose={() => setCreating(false)} />
    </>
  )
}
