import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Lock, Plus, Search, Trash2, UserRound, UserRoundCheck, UsersRound } from 'lucide-react'
import type { ParticipantRequest, ParticipantType, TripParticipant } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useUsers } from '@/queries/admin'
import { useMulheres } from '@/queries/records'
import { PARTICIPANT_LABEL } from '@/lib/fleet'
import { normalize } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Form'

export interface ParticipantDraft {
  key: string
  type: ParticipantType
  userId?: string
  clientId?: string
  name: string
  phone: string
  document: string
  notes: string
  /** atendida que o usuário não pode ver */
  hidden?: boolean
}

let seq = 0
const newKey = () => `p${++seq}`

export function draftFromParticipant(p: TripParticipant): ParticipantDraft {
  return {
    key: newKey(),
    type: p.type,
    userId: p.userId ?? undefined,
    clientId: p.clientId ?? undefined,
    name: p.name ?? '',
    phone: p.phone ?? '',
    document: p.document ?? '',
    notes: p.notes ?? '',
    hidden: p.hidden,
  }
}

export function draftToRequest(d: ParticipantDraft): ParticipantRequest {
  const extra = {
    phone: d.phone.trim() || undefined,
    document: d.document.trim() || undefined,
    notes: d.notes.trim() || undefined,
  }
  if (d.type === 'USER') return { type: 'USER', userId: d.userId, ...extra }
  if (d.type === 'CLIENT') return { type: 'CLIENT', clientId: d.clientId, ...extra }
  return { type: 'EXTERNAL', name: d.name.trim(), ...extra }
}

const TYPE_ICON = { USER: UserRoundCheck, CLIENT: UsersRound, EXTERNAL: UserRound }
const TYPE_TONE = { USER: 'brand', CLIENT: 'warning', EXTERNAL: 'neutral' } as const

/** Busca com lista suspensa (servidoras/atendidas). */
function SearchPicker({
  options,
  placeholder,
  onPick,
  onCancel,
}: {
  options: { id: string; label: string; hint?: string; disabled?: boolean }[]
  placeholder: string
  onPick: (id: string, label: string) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => {
    const n = normalize(q.trim())
    return (n ? options.filter((o) => normalize(o.label).includes(n)) : options).slice(0, 8)
  }, [options, q])

  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onCancel()
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onCancel])

  return (
    <div ref={ref} className="relative animate-fade-down">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
      <Input
        autoFocus
        className="pl-9"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
          if (e.key === 'Enter') {
            e.preventDefault()
            const first = filtered.find((o) => !o.disabled)
            if (first) onPick(first.id, first.label)
          }
        }}
      />
      <ul className="absolute z-20 mt-1 max-h-64 w-full animate-scale-in overflow-y-auto rounded-xl border border-ink-200 bg-surface p-1 shadow-(--shadow-pop)">
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-ink-400">Nenhum resultado</li>
        ) : (
          filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                disabled={o.disabled}
                onClick={() => onPick(o.id, o.label)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-brand-50 hover:text-brand-900 disabled:pointer-events-none disabled:opacity-40"
              >
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-ink-400">{o.hint}</span>}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

/**
 * Lista de participantes da viagem com limite de lugares do veículo.
 * Servidoras exigem a lista de usuários (administração); atendidas exigem poder ler o nome delas.
 */
export function ParticipantsEditor({
  value,
  onChange,
  capacity,
  errors,
}: {
  value: ParticipantDraft[]
  onChange: (v: ParticipantDraft[]) => void
  capacity: number | null
  errors?: Record<string, string>
}) {
  const { isAdmin, mulheresAccess } = useAuth()
  const canClients = mulheresAccess.canRead && mulheresAccess.canReadColumn('nome')
  const [picking, setPicking] = useState<null | 'USER' | 'CLIENT'>(null)
  const users = useUsers(isAdmin && picking === 'USER')
  const clients = useMulheres(canClients && picking === 'CLIENT')

  const full = capacity != null && value.length >= capacity
  const takenUsers = new Set(value.map((v) => v.userId).filter(Boolean))
  const takenClients = new Set(value.map((v) => v.clientId).filter(Boolean))

  const add = (d: Omit<ParticipantDraft, 'key' | 'phone' | 'document' | 'notes'> & Partial<ParticipantDraft>) => {
    onChange([...value, { phone: '', document: '', notes: '', ...d, key: newKey() }])
    setPicking(null)
  }
  const update = (key: string, patch: Partial<ParticipantDraft>) =>
    onChange(value.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  const remove = (key: string) => onChange(value.filter((v) => v.key !== key))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-ink-700">Participantes</p>
          {capacity != null && (
            <div className="flex items-center gap-2" title="Lugares para passageiros do veículo">
              <div className="flex gap-0.5">
                {Array.from({ length: Math.min(capacity, 16) }).map((_, i) => (
                  <span
                    key={i}
                    className={clsx(
                      'h-2 w-2 rounded-sm transition-colors duration-300',
                      i < value.length ? (value.length > capacity ? 'bg-red-500' : 'bg-accent') : 'bg-ink-200',
                    )}
                  />
                ))}
              </div>
              <span className={clsx('text-xs tabular-nums', value.length > capacity ? 'font-semibold text-red-600' : 'text-ink-500')}>
                {value.length}/{capacity} lugares
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isAdmin && (
            <AddChip label="Servidora" disabled={full} onClick={() => setPicking('USER')} />
          )}
          {canClients && <AddChip label="Atendida" disabled={full} onClick={() => setPicking('CLIENT')} />}
          <AddChip
            label="Externo"
            disabled={full}
            onClick={() => add({ type: 'EXTERNAL', name: '' })}
          />
        </div>
      </div>

      {picking === 'USER' && (
        <SearchPicker
          placeholder={users.isPending ? 'Carregando servidoras…' : 'Buscar servidora pelo nome…'}
          options={(users.data ?? [])
            .filter((u) => u.isActive)
            .map((u) => ({ id: u.id, label: u.name, hint: takenUsers.has(u.id) ? 'já incluída' : u.email, disabled: takenUsers.has(u.id) }))}
          onPick={(id, label) => add({ type: 'USER', userId: id, name: label })}
          onCancel={() => setPicking(null)}
        />
      )}
      {picking === 'CLIENT' && (
        <SearchPicker
          placeholder={clients.isPending ? 'Carregando atendidas…' : 'Buscar atendida pelo nome…'}
          options={(clients.data ?? [])
            .filter((m) => m.nome)
            .map((m) => ({ id: m.id, label: m.nome!, hint: takenClients.has(m.id) ? 'já incluída' : undefined, disabled: takenClients.has(m.id) }))}
          onPick={(id, label) => add({ type: 'CLIENT', clientId: id, name: label })}
          onCancel={() => setPicking(null)}
        />
      )}

      {value.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-300 px-4 py-5 text-center text-sm text-ink-400">
          Nenhum participante. A viagem pode ter só o motorista.
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200">
          {value.map((p, i) => {
            const Icon = TYPE_ICON[p.type]
            const nameError = errors?.[`participants[${i}].name`]
            return (
              <li key={p.key} className="animate-fade-down p-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-500">
                    {p.hidden ? <Lock className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={TYPE_TONE[p.type]}>{PARTICIPANT_LABEL[p.type]}</Badge>
                      {p.type === 'EXTERNAL' ? (
                        <Input
                          aria-label="Nome"
                          placeholder="Nome completo *"
                          className={clsx('h-8 py-1', nameError && 'input-error')}
                          value={p.name}
                          maxLength={255}
                          onChange={(e) => update(p.key, { name: e.target.value })}
                        />
                      ) : (
                        <span className="truncate text-sm font-medium text-ink-900">
                          {p.hidden ? <span className="text-ink-400">Atendida (sigilo)</span> : p.name}
                        </span>
                      )}
                    </div>
                    {!p.hidden && (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          aria-label="Telefone"
                          placeholder="Telefone"
                          className="h-8 py-1 text-xs"
                          value={p.phone}
                          maxLength={50}
                          onChange={(e) => update(p.key, { phone: e.target.value })}
                        />
                        <Input
                          aria-label="Documento"
                          placeholder="Documento (CPF/RG)"
                          className="h-8 py-1 text-xs"
                          value={p.document}
                          maxLength={50}
                          onChange={(e) => update(p.key, { document: e.target.value })}
                        />
                        <Input
                          aria-label="Observações"
                          placeholder="Obs. (ex.: acompanhante)"
                          className="h-8 py-1 text-xs"
                          value={p.notes}
                          maxLength={1000}
                          onChange={(e) => update(p.key, { notes: e.target.value })}
                        />
                      </div>
                    )}
                    {nameError && <p className="text-xs text-red-600">{nameError}</p>}
                  </div>
                  <IconButton label="Remover participante" variant="danger-ghost" onClick={() => remove(p.key)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function AddChip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Veículo lotado' : undefined}
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-300 px-2.5 py-1 text-xs font-medium text-ink-600 transition-all hover:border-brand-400 hover:bg-brand-50 hover:text-brand-800 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
    >
      <Plus className="size-3" />
      {label}
    </button>
  )
}
