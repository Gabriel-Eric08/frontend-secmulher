import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  fleetApi,
  type CompleteTripRequest,
  type DriverRequest,
  type StartTripRequest,
  type TripFilters,
  type TripRequest,
  type UUID,
  type VehicleRequest,
} from '@/api'
import { qk } from './keys'

// ---------------------------------------------------------------- Consultas

export const useDrivers = (enabled = true) =>
  useQuery({ queryKey: qk.fleet.drivers, queryFn: fleetApi.drivers.list, enabled })

export const useDriver = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.fleet.driver(id!), queryFn: () => fleetApi.drivers.get(id!), enabled: !!id })

export const useVehicles = (enabled = true) =>
  useQuery({ queryKey: qk.fleet.vehicles, queryFn: fleetApi.vehicles.list, enabled })

export const useVehicle = (id: UUID | undefined, enabled = true) =>
  useQuery({ queryKey: qk.fleet.vehicle(id!), queryFn: () => fleetApi.vehicles.get(id!), enabled: !!id && enabled })

/** Agenda: mantém a semana anterior na tela enquanto a nova carrega (sem piscar). */
export const useTrips = (filters?: TripFilters, enabled = true) =>
  useQuery({
    queryKey: qk.fleet.trips(filters),
    queryFn: () => fleetApi.trips.list(filters),
    enabled,
    placeholderData: keepPreviousData,
  })

export const useMyTrips = (period?: { from?: string; to?: string }, enabled = true) =>
  useQuery({
    queryKey: qk.fleet.mine(period),
    queryFn: () => fleetApi.trips.mine(period),
    enabled,
    placeholderData: keepPreviousData,
  })

/**
 * O usuário logado é motorista? (/fleet/trips/mine responde 404 quando não há vínculo).
 * Usado para mostrar "Minha agenda" no menu, inclusive para quem não tem permissão em Frotas.
 */
export function useIsDriver() {
  const q = useQuery({
    queryKey: ['fleet', 'is-driver'],
    queryFn: async () => {
      try {
        await fleetApi.trips.mine({ from: '2000-01-01', to: '2000-01-01' })
        return true
      } catch (err) {
        if (err instanceof ApiError && (err.isNotFound || err.isForbidden)) return false
        throw err
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
  return q.data === true
}

export const useTrip = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.fleet.trip(id!), queryFn: () => fleetApi.trips.get(id!), enabled: !!id })

/** Motoristas e veículos livres no intervalo; só consulta com um período válido. */
export const useAvailability = (start: string, end: string, enabled = true) =>
  useQuery({
    queryKey: qk.fleet.availability(start, end),
    queryFn: () => fleetApi.availability(start, end),
    enabled: enabled && !!start && !!end && start < end,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })

// ---------------------------------------------------------------- Mutações

function useFleetMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.fleet.all }),
  })
}

export const useSaveDriver = () =>
  useFleetMutation(({ id, body }: { id?: UUID; body: DriverRequest }) =>
    id ? fleetApi.drivers.update(id, body) : fleetApi.drivers.create(body),
  )

export const useDeleteDriver = () => useFleetMutation(fleetApi.drivers.remove)

export const useSaveVehicle = () =>
  useFleetMutation(({ id, body }: { id?: UUID; body: VehicleRequest }) =>
    id ? fleetApi.vehicles.update(id, body) : fleetApi.vehicles.create(body),
  )

export const useDeleteVehicle = () => useFleetMutation(fleetApi.vehicles.remove)

export const useSaveTrip = () =>
  useFleetMutation(({ id, body }: { id?: UUID; body: TripRequest }) =>
    id ? fleetApi.trips.update(id, body) : fleetApi.trips.create(body),
  )

export const useStartTrip = () =>
  useFleetMutation(({ id, body }: { id: UUID; body: StartTripRequest }) => fleetApi.trips.start(id, body))

export const useCompleteTrip = () =>
  useFleetMutation(({ id, body }: { id: UUID; body: CompleteTripRequest }) => fleetApi.trips.complete(id, body))

export const useCancelTrip = () =>
  useFleetMutation(({ id, reason }: { id: UUID; reason: string }) => fleetApi.trips.cancel(id, reason))
