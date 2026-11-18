import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react'
import { ApiError } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useDeleteVehicle, useVehicle } from '@/queries/fleet'
import { formatKm } from '@/lib/fleet'
import { Card, DescriptionList, PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink, IconButton } from '@/components/ui/Button'
import { ErrorState, ForbiddenState } from '@/components/ui/States'
import { PageSkeleton } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { Plate } from '@/components/fleet/FleetUi'
import { VehicleFormModal } from '@/components/fleet/FleetFormModals'
import { ResourceTrips } from '@/components/fleet/ResourceTrips'

export function VeiculoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { fleetAccess: access } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const vehicle = useVehicle(id)
  const del = useDeleteVehicle()
  const [editing, setEditing] = useState(false)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de frotas." />
  if (vehicle.isPending) return <PageSkeleton />
  if (vehicle.isError) return <ErrorState error={vehicle.error} onRetry={() => vehicle.refetch()} />
  const v = vehicle.data
  const title = [v.brand, v.model].filter(Boolean).join(' ')

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir veículo',
      message: (
        <>
          O veículo <strong>{title}</strong> será excluído. Veículos com viagens não podem ser excluídos: desative-os.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(v.id)
      toast.success('Veículo excluído.')
      navigate('/frotas/veiculos')
    } catch (err) {
      toast.error(err instanceof ApiError && err.isConflict ? err.detail : err)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Frotas', to: '/frotas' },
          { label: 'Veículos', to: '/frotas/veiculos' },
          { label: title },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {title}
            <Plate plate={v.plate} />
            {!v.isActive && <Badge>Inativo</Badge>}
          </span>
        }
        actions={
          <>
            {access.canCreate && v.isActive && (
              <ButtonLink to={`/frotas/viagens/nova?veiculo=${v.id}`} icon={<CalendarPlus className="size-4" />}>
                Agendar viagem
              </ButtonLink>
            )}
            {access.canUpdate && (
              <IconButton label="Editar veículo" variant="secondary" className="size-10" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
              </IconButton>
            )}
            {access.canDelete && (
              <IconButton label="Excluir veículo" variant="secondary" className="size-10 hover:text-red-600" onClick={onDelete}>
                <Trash2 className="size-4" />
              </IconButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card title="Dados do veículo">
          <DescriptionList
            items={[
              { label: 'Marca', value: v.brand ?? '—' },
              { label: 'Modelo', value: v.model },
              { label: 'Ano', value: v.year ?? '—' },
              { label: 'Cor', value: v.color ?? '—' },
              { label: 'Passageiros', value: `${v.capacity} (sem o motorista)` },
              { label: 'Odômetro', value: <span className="tabular-nums">{formatKm(v.odometerKm)}</span> },
            ]}
          />
          {v.notes && (
            <div className="mt-4 border-t border-ink-100 pt-4">
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Observações</p>
              <p className="mt-1 text-sm whitespace-pre-line text-ink-800">{v.notes}</p>
            </div>
          )}
        </Card>
        <ResourceTrips vehicleId={v.id} />
      </div>

      <VehicleFormModal open={editing} onClose={() => setEditing(false)} vehicle={v} />
    </>
  )
}
