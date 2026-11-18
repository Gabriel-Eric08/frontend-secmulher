import type { LicenseCategory, LocalDateTime, ParticipantType, Trip, TripStatus } from '@/api'

/*
 * O backend trabalha com LocalDateTime (sem fuso): "2026-11-20T08:00:00".
 * Tudo aqui trata esses valores como horário local, sem conversão de fuso.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** Date -> "AAAA-MM-DD" (local) */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Date -> "AAAA-MM-DDTHH:MM" (local), formato do <input type="datetime-local"> e da API */
export function toLocalDateTime(d: Date): LocalDateTime {
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "AAAA-MM-DD[THH:MM[:SS]]" -> Date local */
export function parseLocal(value: string): Date {
  const [date, time = '00:00'] = value.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm, ss = 0] = time.split(':').map((x) => Number(x.slice(0, 2)))
  return new Date(y, m - 1, d, hh, mm, ss)
}

/** Corta segundos: "2026-11-20T08:00:00" -> "2026-11-20T08:00" */
export const trimSeconds = (v: string | null | undefined) => (v ? v.slice(0, 16) : '')

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Segunda-feira da semana de `d` */
export function startOfWeek(d: Date): Date {
  const day = startOfDay(d)
  const diff = (day.getDay() + 6) % 7
  return addDays(day, -diff)
}

export const isSameDay = (a: Date, b: Date) => toDateKey(a) === toDateKey(b)

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const shortDayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const dayMonthFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const longDayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
const fullFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const formatTime = (v: LocalDateTime) => timeFmt.format(parseLocal(v))
export const formatDateTimeLocal = (v: LocalDateTime | null | undefined) => (v ? fullFmt.format(parseLocal(v)) : '—')
export const weekdayShort = (d: Date) => shortDayFmt.format(d).replace('.', '')
export const dayMonth = (d: Date) => dayMonthFmt.format(d).replace('.', '')
export const longDay = (d: Date) => {
  const s = longDayFmt.format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "20 nov – 26 nov 2026" */
export function weekLabel(start: Date): string {
  const end = addDays(start, 6)
  return `${dayMonth(start)} – ${dayMonth(end)} ${end.getFullYear()}`
}

/**
 * Período da viagem em texto curto: mesmo dia "08:00 – 17:00";
 * dias diferentes "20/11 08:00 – 22/11 17:00".
 */
export function formatPeriod(start: LocalDateTime, end: LocalDateTime): string {
  const a = parseLocal(start)
  const b = parseLocal(end)
  if (isSameDay(a, b)) return `${timeFmt.format(a)} – ${timeFmt.format(b)}`
  const d = (x: Date) => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`
  return `${d(a)} ${timeFmt.format(a)} – ${d(b)} ${timeFmt.format(b)}`
}

/** Duração legível: "2 h 30 min", "3 dias". */
export function formatDuration(start: LocalDateTime, end: LocalDateTime): string {
  const mins = Math.round((parseLocal(end).getTime() - parseLocal(start).getTime()) / 60000)
  if (mins <= 0) return '—'
  if (mins >= 60 * 24) {
    const days = Math.round(mins / (60 * 24))
    return `${days} dia${days > 1 ? 's' : ''}`
  }
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

/** A viagem ocupa algum momento deste dia? (intervalo previsto [ida, volta)) */
export function tripTouchesDay(trip: Pick<Trip, 'departureAt' | 'returnAt'>, day: Date): boolean {
  const start = startOfDay(day).getTime()
  const end = addDays(startOfDay(day), 1).getTime()
  return parseLocal(trip.departureAt).getTime() < end && parseLocal(trip.returnAt).getTime() > start
}

/** Dias até a data (negativo = já passou). */
export function daysUntil(date: string): number {
  return Math.round((parseLocal(date).getTime() - startOfDay(new Date()).getTime()) / 86_400_000)
}

export const formatKm = (km: number | null | undefined) =>
  km == null ? '—' : `${new Intl.NumberFormat('pt-BR').format(km)} km`

/** Placa no padrão de exibição: "ABC1D23" / "ABC-1234" (antigo) */
export function formatPlate(plate: string): string {
  const p = plate.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /^[A-Z]{3}\d{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p
}

// ---------------------------------------------------------------- Rótulos

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
}

export const TRIP_STATUS_TONE: Record<TripStatus, 'brand' | 'warning' | 'success' | 'neutral'> = {
  SCHEDULED: 'brand',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

/** Faixa lateral dos cartões de viagem na agenda */
export const TRIP_STATUS_ACCENT: Record<TripStatus, string> = {
  SCHEDULED: 'border-l-brand-500',
  IN_PROGRESS: 'border-l-amber-500',
  COMPLETED: 'border-l-emerald-500',
  CANCELLED: 'border-l-ink-300',
}

export const PARTICIPANT_LABEL: Record<ParticipantType, string> = {
  USER: 'Servidora',
  CLIENT: 'Atendida',
  EXTERNAL: 'Externo',
}

export const LICENSE_CATEGORIES: LicenseCategory[] = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE']

/** Situação da CNH: vencida, vencendo em até 30 dias ou válida. */
export function licenseState(expiry: string): { tone: 'danger' | 'warning' | 'success'; label: string } {
  const d = daysUntil(expiry)
  if (d < 0) return { tone: 'danger', label: 'CNH vencida' }
  if (d === 0) return { tone: 'warning', label: 'CNH vence hoje' }
  if (d <= 30) return { tone: 'warning', label: `CNH vence em ${d} dia${d > 1 ? 's' : ''}` }
  return { tone: 'success', label: 'CNH válida' }
}
