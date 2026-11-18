import { http } from './http'
import type { ISODate, UUID } from './types'

/**
 * Módulo de frotas: motoristas, veículos, viagens e participantes.
 * Datas e horas são LocalDateTime do backend, sem fuso: "AAAA-MM-DDTHH:MM[:SS]".
 */

/** "AAAA-MM-DDTHH:MM[:SS]" (horário local, sem fuso) */
export type LocalDateTime = string

export type TripStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type ParticipantType = 'USER' | 'CLIENT' | 'EXTERNAL'
export type LicenseCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'AB' | 'AC' | 'AD' | 'AE'

// ---------------------------------------------------------------- Motoristas

export interface Driver {
  id: UUID
  name: string
  phone: string | null
  licenseNumber: string
  licenseCategory: LicenseCategory
  licenseExpiry: ISODate
  /** CNH vencida hoje */
  licenseExpired: boolean
  userId: UUID | null
  userName: string | null
  notes: string | null
  isActive: boolean
  createdAt: LocalDateTime
  updatedAt: LocalDateTime
}

export interface DriverRequest {
  name: string
  phone?: string
  licenseNumber: string
  licenseCategory: LicenseCategory
  licenseExpiry: ISODate
  userId?: UUID | null
  notes?: string
  isActive?: boolean
}

// ---------------------------------------------------------------- Veículos

export interface Vehicle {
  id: UUID
  plate: string
  brand: string | null
  model: string
  year: number | null
  color: string | null
  /** Lugares para passageiros, sem o motorista */
  capacity: number
  odometerKm: number
  notes: string | null
  isActive: boolean
  createdAt: LocalDateTime
  updatedAt: LocalDateTime
}

export interface VehicleRequest {
  plate: string
  brand?: string
  model: string
  year?: number | null
  color?: string
  capacity: number
  odometerKm?: number
  notes?: string
  isActive?: boolean
}

// ---------------------------------------------------------------- Viagens

export interface TripParticipant {
  id: UUID
  type: ParticipantType
  userId: UUID | null
  clientId: UUID | null
  /** null quando `hidden` */
  name: string | null
  phone: string | null
  document: string | null
  notes: string | null
  /** Atendida cujo nome o usuário não pode ver */
  hidden: boolean
}

export interface Trip {
  id: UUID
  number: number
  status: TripStatus
  statusLabel: string
  purpose: string
  description: string | null
  departureLocation: string
  destination: string
  departureAt: LocalDateTime
  returnAt: LocalDateTime
  driver: { id: UUID; name: string; phone: string | null }
  vehicle: { id: UUID; plate: string; brand: string | null; model: string; capacity: number }
  participantCount: number
  participants: TripParticipant[]
  actualDepartureAt: LocalDateTime | null
  actualReturnAt: LocalDateTime | null
  startOdometerKm: number | null
  endOdometerKm: number | null
  distanceKm: number | null
  completionNotes: string | null
  cancellationReason: string | null
  cancelledAt: LocalDateTime | null
  cancelledBy: UUID | null
  createdBy: UUID | null
  createdAt: LocalDateTime
  updatedAt: LocalDateTime
}

export interface ParticipantRequest {
  type: ParticipantType
  userId?: UUID
  clientId?: UUID
  name?: string
  phone?: string
  document?: string
  notes?: string
}

export interface TripRequest {
  driverId: UUID
  vehicleId: UUID
  purpose: string
  description?: string
  departureLocation: string
  destination: string
  departureAt: LocalDateTime
  returnAt: LocalDateTime
  participants: ParticipantRequest[]
}

export interface StartTripRequest {
  startOdometerKm: number
  actualDepartureAt?: LocalDateTime
}

export interface CompleteTripRequest {
  endOdometerKm: number
  actualReturnAt?: LocalDateTime
  notes?: string
}

export interface TripFilters {
  from?: ISODate
  to?: ISODate
  driverId?: UUID
  vehicleId?: UUID
  status?: TripStatus
}

export interface Availability {
  start: LocalDateTime
  end: LocalDateTime
  drivers: Driver[]
  vehicles: Vehicle[]
}

function clean<T extends object>(params: T | undefined): Partial<T> | undefined {
  if (!params) return undefined
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>
}

export const fleetApi = {
  drivers: {
    list: () => http.get<Driver[]>('/fleet/drivers').then((r) => r.data),
    get: (id: UUID) => http.get<Driver>(`/fleet/drivers/${id}`).then((r) => r.data),
    create: (body: DriverRequest) => http.post<Driver>('/fleet/drivers', body).then((r) => r.data),
    update: (id: UUID, body: DriverRequest) => http.put<Driver>(`/fleet/drivers/${id}`, body).then((r) => r.data),
    remove: (id: UUID) => http.delete<void>(`/fleet/drivers/${id}`).then(() => undefined),
  },
  vehicles: {
    list: () => http.get<Vehicle[]>('/fleet/vehicles').then((r) => r.data),
    get: (id: UUID) => http.get<Vehicle>(`/fleet/vehicles/${id}`).then((r) => r.data),
    create: (body: VehicleRequest) => http.post<Vehicle>('/fleet/vehicles', body).then((r) => r.data),
    update: (id: UUID, body: VehicleRequest) => http.put<Vehicle>(`/fleet/vehicles/${id}`, body).then((r) => r.data),
    remove: (id: UUID) => http.delete<void>(`/fleet/vehicles/${id}`).then(() => undefined),
  },
  trips: {
    list: (filters?: TripFilters) => http.get<Trip[]>('/fleet/trips', { params: clean(filters) }).then((r) => r.data),
    mine: (period?: { from?: ISODate; to?: ISODate }) =>
      http.get<Trip[]>('/fleet/trips/mine', { params: clean(period) }).then((r) => r.data),
    get: (id: UUID) => http.get<Trip>(`/fleet/trips/${id}`).then((r) => r.data),
    create: (body: TripRequest) => http.post<Trip>('/fleet/trips', body).then((r) => r.data),
    update: (id: UUID, body: TripRequest) => http.put<Trip>(`/fleet/trips/${id}`, body).then((r) => r.data),
    start: (id: UUID, body: StartTripRequest) => http.post<Trip>(`/fleet/trips/${id}/start`, body).then((r) => r.data),
    complete: (id: UUID, body: CompleteTripRequest) =>
      http.post<Trip>(`/fleet/trips/${id}/complete`, body).then((r) => r.data),
    cancel: (id: UUID, reason: string) => http.post<Trip>(`/fleet/trips/${id}/cancel`, { reason }).then((r) => r.data),
  },
  availability: (start: LocalDateTime, end: LocalDateTime) =>
    http.get<Availability>('/fleet/availability', { params: { start, end } }).then((r) => r.data),
}
