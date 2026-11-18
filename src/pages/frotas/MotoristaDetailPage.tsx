import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react'
import { ApiError } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useDeleteDriver, useDriver } from '@/queries/fleet'
import { formatDate } from '@/lib/format'
import { Avatar, Card, DescriptionList, PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink, IconButton } from '@/components/ui/Button'
import { ErrorState, ForbiddenState } from '@/components/ui/States'
import { PageSkeleton } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { LicenseBadge } from '@/components/fleet/FleetUi'
import { DriverFormModal } from '@/components/fleet/FleetFormModals'
import { ResourceTrips } from '@/components/fleet/ResourceTrips'

export function MotoristaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { fleetAccess: access } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const driver = useDriver(id)
  const del = useDeleteDriver()
  const [editing, setEditing] = useState(false)

  if (!access.canRead) return <ForbiddenState message="Seu perfil não tem acesso ao módulo de frotas." />
  if (driver.isPending) return <PageSkeleton />
  if (driver.isError) return <ErrorState error={driver.error} onRetry={() => driver.refetch()} />
  const d = driver.data

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir motorista',
      message: (
        <>
          <strong>{d.name}</strong> será excluído. Motoristas com viagens não podem ser excluídos: desative-os.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(d.id)
      toast.success('Motorista excluído.')
      navigate('/frotas/motoristas')
    } catch (err) {
      toast.error(err instanceof ApiError && err.isConflict ? err.detail : err)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Frotas', to: '/frotas' },
          { label: 'Motoristas', to: '/frotas/motoristas' },
          { label: d.name },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar name={d.name} size="md" />
            {d.name}
            {!d.isActive && <Badge>Inativo</Badge>}
          </span>
        }
        actions={
          <>
            {access.canCreate && d.isActive && (
              <ButtonLink to={`/frotas/viagens/nova?motorista=${d.id}`} icon={<CalendarPlus className="size-4" />}>
                Agendar viagem
              </ButtonLink>
            )}
            {access.canUpdate && (
              <IconButton label="Editar motorista" variant="secondary" className="size-10" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
              </IconButton>
            )}
            {access.canDelete && (
              <IconButton label="Excluir motorista" variant="secondary" className="size-10 hover:text-red-600" onClick={onDelete}>
                <Trash2 className="size-4" />
              </IconButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card title="Dados do motorista">
          <DescriptionList
            items={[
              { label: 'CNH', value: <span className="font-mono tracking-wider">{d.licenseNumber}</span> },
              { label: 'Categoria', value: <span className="font-mono">{d.licenseCategory}</span> },
              {
                label: 'Validade',
                value: (
                  <span className="flex flex-wrap items-center gap-2">
                    {formatDate(d.licenseExpiry)}
                    <LicenseBadge expiry={d.licenseExpiry} />
                  </span>
                ),
              },
              { label: 'Telefone', value: d.phone ?? '—' },
              { label: 'Usuário vinculado', value: d.userName ?? 'Sem vínculo' },
            ]}
          />
          {d.notes && (
            <div className="mt-4 border-t border-ink-100 pt-4">
              <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">Observações</p>
              <p className="mt-1 text-sm whitespace-pre-line text-ink-800">{d.notes}</p>
            </div>
          )}
        </Card>
        <ResourceTrips driverId={d.id} />
      </div>

      <DriverFormModal open={editing} onClose={() => setEditing(false)} driver={d} />
    </>
  )
}
