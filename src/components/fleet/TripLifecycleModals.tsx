import { useEffect, useState, type FormEvent } from 'react'
import { Gauge, Route } from 'lucide-react'
import { ApiError, type Trip } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useCancelTrip, useCompleteTrip, useStartTrip, useVehicle } from '@/queries/fleet'
import { formatDateTimeLocal, formatDuration, formatKm, toLocalDateTime, trimSeconds } from '@/lib/fleet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'

type Errors = Record<string, string>
export type TripAction = 'start' | 'complete' | 'cancel'

function useErrorHandler() {
  const toast = useToast()
  return (err: unknown, setErrors: (e: Errors) => void) => {
    if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
    else toast.error(err)
  }
}

export function TripLifecycleModal({ trip, action, onClose }: { trip: Trip; action: TripAction | null; onClose: () => void }) {
  if (action === 'start') return <StartModal trip={trip} onClose={onClose} />
  if (action === 'complete') return <CompleteModal trip={trip} onClose={onClose} />
  if (action === 'cancel') return <CancelModal trip={trip} onClose={onClose} />
  return null
}

function StartModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const { fleetAccess } = useAuth()
  const start = useStartTrip()
  // sugere o km inicial a partir do odômetro atual do veículo
  const vehicle = useVehicle(trip.vehicle.id, fleetAccess.canRead)
  const [km, setKm] = useState('')
  const [at, setAt] = useState(() => toLocalDateTime(new Date()))
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (vehicle.data && km === '') setKm(String(vehicle.data.odometerKm))
  }, [vehicle.data, km])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (km === '' || Number(km) < 0) return setErrors({ startOdometerKm: 'Informe a quilometragem de saída.' })
    try {
      await start.mutateAsync({ id: trip.id, body: { startOdometerKm: Number(km), actualDepartureAt: at || undefined } })
      toast.success(`Viagem nº ${trip.number} iniciada.`)
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Iniciar viagem"
      description={`Registra a saída real de “${trip.purpose}”.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="start-form" loading={start.isPending}>
            Iniciar viagem
          </Button>
        </>
      }
    >
      <form id="start-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Km na saída"
            htmlFor="st-km"
            required
            error={errors.startOdometerKm}
            hint={vehicle.data ? `Odômetro do veículo: ${formatKm(vehicle.data.odometerKm)}` : undefined}
          >
            <div className="relative">
              <Gauge className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
              <Input
                id="st-km"
                type="number"
                min={0}
                className="pl-9 tabular-nums"
                value={km}
                invalid={!!errors.startOdometerKm}
                onChange={(e) => setKm(e.target.value)}
              />
            </div>
          </Field>
          <Field label="Saída real" htmlFor="st-at" error={errors.actualDepartureAt} hint={`Prevista: ${formatDateTimeLocal(trip.departureAt)}`}>
            <Input id="st-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

function CompleteModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const complete = useCompleteTrip()
  const [km, setKm] = useState('')
  const [at, setAt] = useState(() => toLocalDateTime(new Date()))
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const startKm = trip.startOdometerKm ?? 0
  const distance = km !== '' ? Number(km) - startKm : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (km === '') return setErrors({ endOdometerKm: 'Informe a quilometragem de chegada.' })
    if (Number(km) < startKm) return setErrors({ endOdometerKm: `Não pode ser menor que a de saída (${formatKm(startKm)}).` })
    if (trip.actualDepartureAt && at && at < trimSeconds(trip.actualDepartureAt))
      return setErrors({ actualReturnAt: 'A volta não pode ser antes da saída.' })
    try {
      await complete.mutateAsync({
        id: trip.id,
        body: { endOdometerKm: Number(km), actualReturnAt: at || undefined, notes: notes.trim() || undefined },
      })
      toast.success(`Viagem nº ${trip.number} concluída.`)
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Concluir viagem"
      description="Registra a volta; o odômetro do veículo avança com a km final."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="complete-form" loading={complete.isPending}>
            Concluir viagem
          </Button>
        </>
      }
    >
      <form id="complete-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Km na chegada" htmlFor="cp-km" required error={errors.endOdometerKm} hint={`Saída: ${formatKm(startKm)}`}>
            <Input
              id="cp-km"
              type="number"
              min={startKm}
              className="tabular-nums"
              value={km}
              invalid={!!errors.endOdometerKm}
              onChange={(e) => setKm(e.target.value)}
            />
          </Field>
          <Field label="Volta real" htmlFor="cp-at" error={errors.actualReturnAt} hint={`Prevista: ${formatDateTimeLocal(trip.returnAt)}`}>
            <Input id="cp-at" type="datetime-local" value={at} invalid={!!errors.actualReturnAt} onChange={(e) => setAt(e.target.value)} />
          </Field>
        </div>
        {(distance != null && distance >= 0) || trip.actualDepartureAt ? (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-ink-50 p-4 text-sm">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <Route className="size-3.5" /> Distância
              </p>
              <p className="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums">
                {distance != null && distance >= 0 ? formatKm(distance) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Duração</p>
              <p className="mt-0.5 text-lg font-semibold text-ink-900 tabular-nums">
                {trip.actualDepartureAt && at ? formatDuration(trip.actualDepartureAt, at) : '—'}
              </p>
            </div>
          </div>
        ) : null}
        <Field label="Observações" htmlFor="cp-notes" error={errors.notes}>
          <Textarea
            id="cp-notes"
            className="min-h-16"
            maxLength={4000}
            placeholder="Ocorrências, abastecimento, condições do veículo…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}

function CancelModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const cancel = useCancelTrip()
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return setErrors({ reason: 'Informe o motivo.' })
    try {
      await cancel.mutateAsync({ id: trip.id, reason: reason.trim() })
      toast.success(`Viagem nº ${trip.number} cancelada.`)
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancelar viagem"
      description="O motorista e o veículo ficam livres neste horário. Não é possível desfazer."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button type="submit" form="cancel-form" variant="danger" loading={cancel.isPending}>
            Cancelar viagem
          </Button>
        </>
      }
    >
      <form id="cancel-form" onSubmit={submit}>
        <Field label="Motivo" htmlFor="cc-reason" required error={errors.reason}>
          <Textarea
            id="cc-reason"
            className="min-h-24"
            maxLength={2000}
            value={reason}
            invalid={!!errors.reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  )
}
