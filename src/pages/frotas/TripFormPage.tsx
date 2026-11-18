import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, Car, Check, Clock, MapPin, UserRound } from 'lucide-react'
import { ApiError, type Driver, type Vehicle } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useAvailability, useDrivers, useSaveTrip, useTrip, useVehicles } from '@/queries/fleet'
import {
  addDays,
  formatDuration,
  formatKm,
  licenseState,
  parseLocal,
  toDateKey,
  toLocalDateTime,
  trimSeconds,
} from '@/lib/fleet'
import { PageHeader } from '@/components/ui/Layout'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { Alert, ErrorState, ForbiddenState } from '@/components/ui/States'
import { PageSkeleton, Skeleton } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { Plate } from '@/components/fleet/FleetUi'
import {
  ParticipantsEditor,
  draftFromParticipant,
  draftToRequest,
  type ParticipantDraft,
} from '@/components/fleet/ParticipantsEditor'

type Errors = Record<string, string>

function defaultPeriod(date?: string | null) {
  const base = date ? parseLocal(date) : addDays(new Date(), 1)
  const day = toDateKey(base)
  return { departureAt: `${day}T08:00`, returnAt: `${day}T17:00` }
}

/** Por que o motorista não pode ser escalado no período (null = pode). */
function driverBlock(d: Driver, available: boolean, returnAt: string): string | null {
  if (!d.isActive) return 'Inativo'
  if (returnAt && d.licenseExpiry < returnAt.slice(0, 10)) return licenseState(d.licenseExpiry).label
  if (!available) return 'Ocupado no horário'
  return null
}

function vehicleBlock(v: Vehicle, available: boolean): string | null {
  if (!v.isActive) return 'Inativo'
  if (!available) return 'Ocupado no horário'
  return null
}

export function TripFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { fleetAccess: access, mulheresAccess } = useAuth()
  const existing = useTrip(id)
  const drivers = useDrivers(access.canRead)
  const vehicles = useVehicles(access.canRead)
  const save = useSaveTrip()

  const [form, setForm] = useState(() => ({
    purpose: '',
    description: '',
    departureLocation: '',
    destination: '',
    ...defaultPeriod(params.get('data')),
  }))
  const [driverId, setDriverId] = useState(params.get('motorista') ?? '')
  const [vehicleId, setVehicleId] = useState(params.get('veiculo') ?? '')
  const [participants, setParticipants] = useState<ParticipantDraft[]>([])
  const [errors, setErrors] = useState<Errors>({})
  const [loaded, setLoaded] = useState(!isEdit)

  // Preenche com a viagem existente uma única vez
  useEffect(() => {
    const t = existing.data
    if (!t || loaded) return
    setForm({
      purpose: t.purpose,
      description: t.description ?? '',
      departureLocation: t.departureLocation,
      destination: t.destination,
      departureAt: trimSeconds(t.departureAt),
      returnAt: trimSeconds(t.returnAt),
    })
    setDriverId(t.driver.id)
    setVehicleId(t.vehicle.id)
    setParticipants(t.participants.map(draftFromParticipant))
    setLoaded(true)
  }, [existing.data, loaded])

  const periodValid = !!form.departureAt && !!form.returnAt && form.returnAt > form.departureAt
  const availability = useAvailability(form.departureAt, form.returnAt, access.canRead && periodValid)

  const freeDrivers = useMemo(() => new Set(availability.data?.drivers.map((d) => d.id)), [availability.data])
  const freeVehicles = useMemo(() => new Set(availability.data?.vehicles.map((v) => v.id)), [availability.data])
  // Na edição, o motorista e o veículo da própria viagem aparecem ocupados por ela mesma
  const ownDriver = existing.data?.driver.id
  const ownVehicle = existing.data?.vehicle.id

  const driverList = useMemo(
    () =>
      (drivers.data ?? [])
        .map((d) => ({ d, block: driverBlock(d, freeDrivers.has(d.id) || d.id === ownDriver, form.returnAt) }))
        .sort((a, b) => Number(!!a.block) - Number(!!b.block) || a.d.name.localeCompare(b.d.name, 'pt-BR')),
    [drivers.data, freeDrivers, ownDriver, form.returnAt],
  )
  const vehicleList = useMemo(
    () =>
      (vehicles.data ?? [])
        .map((v) => ({ v, block: vehicleBlock(v, freeVehicles.has(v.id) || v.id === ownVehicle) }))
        .sort((a, b) => Number(!!a.block) - Number(!!b.block) || a.v.plate.localeCompare(b.v.plate)),
    [vehicles.data, freeVehicles, ownVehicle],
  )

  const selectedVehicle = vehicles.data?.find((v) => v.id === vehicleId)
  const selectedDriverBlock = driverList.find((x) => x.d.id === driverId)?.block
  const selectedVehicleBlock = vehicleList.find((x) => x.v.id === vehicleId)?.block
  const hasHiddenClients = participants.some((p) => p.hidden)
  const canIncludeClients = mulheresAccess.canRead && mulheresAccess.canReadColumn('nome')

  if (!(isEdit ? access.canUpdate : access.canCreate))
    return <ForbiddenState message="Seu perfil não pode agendar ou editar viagens." />
  if (isEdit && existing.isPending) return <PageSkeleton />
  if (isEdit && existing.isError) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
  if (isEdit && existing.data && existing.data.status !== 'SCHEDULED')
    return (
      <div className="card">
        <ErrorState error={new Error('Só viagens agendadas podem ser editadas.')} />
      </div>
    )

  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!form.purpose.trim()) errs.purpose = 'Informe o motivo da viagem.'
    if (!form.departureLocation.trim()) errs.departureLocation = 'Informe a partida.'
    if (!form.destination.trim()) errs.destination = 'Informe o destino.'
    if (!periodValid) errs.returnAt = 'A volta precisa ser depois da ida.'
    if (!driverId) errs.driverId = 'Escolha o motorista.'
    if (!vehicleId) errs.vehicleId = 'Escolha o veículo.'
    participants.forEach((p, i) => {
      if (p.type === 'EXTERNAL' && !p.name.trim()) errs[`participants[${i}].name`] = 'Informe o nome do participante.'
    })
    if (selectedVehicle && participants.length > selectedVehicle.capacity)
      errs.participants = `O veículo leva ${selectedVehicle.capacity} passageiro(s).`
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast.error('Revise os campos destacados.')
      return
    }
    try {
      const trip = await save.mutateAsync({
        id,
        body: {
          driverId,
          vehicleId,
          purpose: form.purpose.trim(),
          description: form.description.trim() || undefined,
          departureLocation: form.departureLocation.trim(),
          destination: form.destination.trim(),
          departureAt: form.departureAt,
          returnAt: form.returnAt,
          participants: participants.map(draftToRequest),
        },
      })
      toast.success(isEdit ? 'Viagem atualizada.' : `Viagem nº ${trip.number} agendada.`)
      navigate(`/frotas/viagens/${trip.id}`, { replace: true })
    } catch (err) {
      // 409 = conflito de agenda; a mensagem do backend já diz com qual viagem
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      toast.error(err)
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        breadcrumbs={[
          { label: 'Frotas', to: '/frotas' },
          ...(isEdit && existing.data ? [{ label: `Viagem nº ${existing.data.number}`, to: `/frotas/viagens/${id}` }] : []),
          { label: isEdit ? 'Editar' : 'Nova viagem' },
        ]}
        title={isEdit ? 'Editar viagem' : 'Agendar viagem'}
        description="Escolha o horário primeiro: a escala mostra quem está livre no período."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending} disabled={hasHiddenClients && !canIncludeClients}>
              {isEdit ? 'Salvar alterações' : 'Agendar viagem'}
            </Button>
          </>
        }
      />

      {hasHiddenClients && !canIncludeClients && (
        <div className="mb-6">
          <Alert tone="warning" title="Viagem com atendidas sob sigilo">
            Para editar esta viagem é preciso poder ver o nome das atendidas. Peça à administração ou a quem tem esse acesso.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <section className="card space-y-4 p-5">
            <Field label="Motivo da viagem" htmlFor="tp-purpose" required error={errors.purpose}>
              <Input
                id="tp-purpose"
                value={form.purpose}
                maxLength={255}
                placeholder="Ex.: Visita técnica ao CRAS de Caruaru"
                invalid={!!errors.purpose}
                onChange={(e) => set('purpose', e.target.value)}
              />
            </Field>
            <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto_1fr]">
              <Field label="Partida" htmlFor="tp-from" required error={errors.departureLocation}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 size-2.5 -translate-y-1/2 rounded-full border-2 border-brand-500" />
                  <Input
                    id="tp-from"
                    className="pl-8"
                    value={form.departureLocation}
                    maxLength={255}
                    placeholder="Sede da Secretaria"
                    invalid={!!errors.departureLocation}
                    onChange={(e) => set('departureLocation', e.target.value)}
                  />
                </div>
              </Field>
              <ArrowRight className="mx-auto mt-9 hidden size-4 text-ink-300 sm:block" />
              <Field label="Destino" htmlFor="tp-to" required error={errors.destination}>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-brand-600" />
                  <Input
                    id="tp-to"
                    className="pl-8"
                    value={form.destination}
                    maxLength={255}
                    invalid={!!errors.destination}
                    onChange={(e) => set('destination', e.target.value)}
                  />
                </div>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
              <Field label="Ida" htmlFor="tp-dep" required error={errors.departureAt}>
                <Input
                  id="tp-dep"
                  type="datetime-local"
                  value={form.departureAt}
                  invalid={!!errors.departureAt}
                  onChange={(e) => {
                    const v = e.target.value
                    // mantém a duração ao mover a ida para depois da volta
                    setForm((f) => ({ ...f, departureAt: v, returnAt: f.returnAt <= v ? toLocalDateTime(new Date(parseLocal(v).getTime() + 2 * 3600_000)) : f.returnAt }))
                  }}
                />
              </Field>
              <Field label="Volta" htmlFor="tp-ret" required error={errors.returnAt}>
                <Input
                  id="tp-ret"
                  type="datetime-local"
                  value={form.returnAt}
                  min={form.departureAt}
                  invalid={!!errors.returnAt}
                  onChange={(e) => set('returnAt', e.target.value)}
                />
              </Field>
              <div className="flex h-full items-end pb-2.5">
                {periodValid && (
                  <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 whitespace-nowrap">
                    <Clock className="size-3.5" />
                    {formatDuration(form.departureAt, form.returnAt)}
                  </span>
                )}
              </div>
            </div>
            <Field label="Descrição" htmlFor="tp-desc" error={errors.description}>
              <Textarea
                id="tp-desc"
                className="min-h-20"
                maxLength={4000}
                placeholder="Agenda, contatos no destino, materiais…"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>
          </section>

          <section className="card p-5">
            <ParticipantsEditor
              value={participants}
              onChange={setParticipants}
              capacity={selectedVehicle?.capacity ?? null}
              errors={errors}
            />
            {errors.participants && <p className="mt-2 text-xs text-red-600">{errors.participants}</p>}
          </section>
        </div>

        {/* Escala: motorista e veículo livres no período */}
        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <ResourcePicker
            title="Motorista"
            icon={<UserRound className="size-4" />}
            error={errors.driverId}
            loading={drivers.isPending || (periodValid && availability.isPending)}
            disabledReason={!periodValid ? 'Defina ida e volta para ver quem está livre.' : undefined}
            selectedBlock={selectedDriverBlock}
            empty="Nenhum motorista cadastrado."
            items={driverList.map(({ d, block }) => ({
              id: d.id,
              block,
              selected: d.id === driverId,
              onSelect: () => setDriverId(d.id),
              title: d.name,
              subtitle: `CNH ${d.licenseCategory}${d.phone ? ` · ${d.phone}` : ''}`,
            }))}
          />
          <ResourcePicker
            title="Veículo"
            icon={<Car className="size-4" />}
            error={errors.vehicleId}
            loading={vehicles.isPending || (periodValid && availability.isPending)}
            disabledReason={!periodValid ? 'Defina ida e volta para ver o que está livre.' : undefined}
            selectedBlock={selectedVehicleBlock}
            empty="Nenhum veículo cadastrado."
            items={vehicleList.map(({ v, block }) => ({
              id: v.id,
              block,
              selected: v.id === vehicleId,
              onSelect: () => setVehicleId(v.id),
              title: [v.brand, v.model].filter(Boolean).join(' '),
              subtitle: `${v.capacity} passageiro(s) · ${formatKm(v.odometerKm)}`,
              leading: <Plate plate={v.plate} size="sm" />,
            }))}
          />
        </aside>
      </div>
    </form>
  )
}

interface PickerItem {
  id: string
  title: string
  subtitle: string
  block: string | null
  selected: boolean
  onSelect: () => void
  leading?: React.ReactNode
}

function ResourcePicker({
  title,
  icon,
  items,
  error,
  loading,
  disabledReason,
  selectedBlock,
  empty,
}: {
  title: string
  icon: React.ReactNode
  items: PickerItem[]
  error?: string
  loading: boolean
  disabledReason?: string
  selectedBlock?: string | null
  empty: string
}) {
  const free = items.filter((i) => !i.block).length
  return (
    <section className={clsx('card overflow-hidden', error && 'border-red-300')}>
      <header className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <span className="text-brand-600">{icon}</span>
          {title}
        </h2>
        {!disabledReason && !loading && (
          <span className="text-xs text-ink-500 tabular-nums">
            {free} livre{free === 1 ? '' : 's'} de {items.length}
          </span>
        )}
      </header>
      {selectedBlock && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          O selecionado está indisponível: {selectedBlock.toLowerCase()}.
        </p>
      )}
      {disabledReason ? (
        <p className="px-4 py-6 text-center text-sm text-ink-400">{disabledReason}</p>
      ) : loading ? (
        <div className="space-y-2 p-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-400">{empty}</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto p-2" role="radiogroup" aria-label={title}>
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                role="radio"
                aria-checked={it.selected}
                disabled={!!it.block && !it.selected}
                onClick={it.onSelect}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-150',
                  it.selected
                    ? 'border-brand-400 bg-brand-50 shadow-(--shadow-glow)'
                    : 'border-transparent hover:border-ink-200 hover:bg-ink-50',
                  it.block && !it.selected && 'cursor-not-allowed opacity-50',
                )}
              >
                {it.leading}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">{it.title}</span>
                  <span className="block truncate text-xs text-ink-500">{it.block ?? it.subtitle}</span>
                </span>
                <span
                  className={clsx(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border transition-all',
                    it.selected ? 'border-accent bg-accent text-white' : 'border-ink-300',
                  )}
                >
                  {it.selected && <Check className="size-3" />}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="border-t border-red-200 px-4 py-2 text-xs text-red-600">{error}</p>}
    </section>
  )
}
