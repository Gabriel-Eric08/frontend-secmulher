import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, type Driver, type LicenseCategory, type Vehicle } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useUsers } from '@/queries/admin'
import { useDrivers, useSaveDriver, useSaveVehicle } from '@/queries/fleet'
import { LICENSE_CATEGORIES, formatPlate, licenseState } from '@/lib/fleet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { Plate } from './FleetUi'

type Errors = Record<string, string>

function applyApiError(err: unknown, setErrors: (e: Errors) => void, toast: ReturnType<typeof useToast>) {
  if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
  else toast.error(err)
}

function Footer({ onClose, form, loading, label }: { onClose: () => void; form: string; loading: boolean; label: string }) {
  return (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancelar
      </Button>
      <Button type="submit" form={form} loading={loading}>
        {label}
      </Button>
    </>
  )
}

// ---------------------------------------------------------------- Motorista

const emptyDriver = {
  name: '',
  phone: '',
  licenseNumber: '',
  licenseCategory: 'B' as LicenseCategory,
  licenseExpiry: '',
  userId: '',
  notes: '',
  isActive: true,
}

export function DriverFormModal({ open, onClose, driver }: { open: boolean; onClose: () => void; driver?: Driver | null }) {
  const toast = useToast()
  const { isAdmin } = useAuth()
  const save = useSaveDriver()
  // Vincular a um usuário exige a lista de usuários, que só a administração enxerga
  const users = useUsers(open && isAdmin)
  const drivers = useDrivers(open && isAdmin)
  const isEdit = !!driver
  const [form, setForm] = useState(emptyDriver)
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      driver
        ? {
            name: driver.name,
            phone: driver.phone ?? '',
            licenseNumber: driver.licenseNumber,
            licenseCategory: driver.licenseCategory,
            licenseExpiry: driver.licenseExpiry,
            userId: driver.userId ?? '',
            notes: driver.notes ?? '',
            isActive: driver.isActive,
          }
        : emptyDriver,
    )
  }, [open, driver])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  // Um usuário só pode estar vinculado a um motorista
  const linkedUserIds = new Set((drivers.data ?? []).filter((d) => d.id !== driver?.id && d.userId).map((d) => d.userId))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!form.name.trim()) errs.name = 'Informe o nome.'
    if (!/^\d{9,11}$/.test(form.licenseNumber)) errs.licenseNumber = 'A CNH tem de 9 a 11 dígitos.'
    if (!form.licenseExpiry) errs.licenseExpiry = 'Informe a validade.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await save.mutateAsync({
        id: driver?.id,
        body: {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          licenseNumber: form.licenseNumber,
          licenseCategory: form.licenseCategory,
          licenseExpiry: form.licenseExpiry,
          // quem não é admin não vê a lista: mantém o vínculo que já existia
          userId: isAdmin ? form.userId || null : driver?.userId ?? null,
          notes: form.notes.trim() || undefined,
          isActive: form.isActive,
        },
      })
      toast.success(isEdit ? 'Motorista atualizado.' : 'Motorista cadastrado.')
      onClose()
    } catch (err) {
      applyApiError(err, setErrors, toast)
    }
  }

  const expiryState = form.licenseExpiry ? licenseState(form.licenseExpiry) : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Editar motorista' : 'Novo motorista'}
      footer={<Footer onClose={onClose} form="driver-form" loading={save.isPending} label={isEdit ? 'Salvar' : 'Cadastrar'} />}
    >
      <form id="driver-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Nome" htmlFor="dr-name" required error={errors.name}>
            <Input id="dr-name" value={form.name} maxLength={255} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Telefone" htmlFor="dr-phone" error={errors.phone}>
            <Input id="dr-phone" type="tel" value={form.phone} maxLength={50} onChange={(e) => set('phone', e.target.value)} />
          </Field>
        </div>

        <fieldset className="rounded-xl border border-ink-200 p-4">
          <legend className="px-1.5 text-xs font-semibold tracking-wider text-ink-500 uppercase">Habilitação</legend>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem_11rem]">
            <Field label="Nº da CNH" htmlFor="dr-cnh" required error={errors.licenseNumber}>
              <Input
                id="dr-cnh"
                inputMode="numeric"
                className="font-mono tracking-wider"
                value={form.licenseNumber}
                invalid={!!errors.licenseNumber}
                onChange={(e) => set('licenseNumber', e.target.value.replace(/\D/g, '').slice(0, 11))}
              />
            </Field>
            <Field label="Categoria" htmlFor="dr-cat" required error={errors.licenseCategory}>
              <Select id="dr-cat" value={form.licenseCategory} onChange={(e) => set('licenseCategory', e.target.value as LicenseCategory)}>
                {LICENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Validade"
              htmlFor="dr-exp"
              required
              error={errors.licenseExpiry}
              hint={expiryState && expiryState.tone !== 'success' ? expiryState.label : undefined}
            >
              <Input
                id="dr-exp"
                type="date"
                value={form.licenseExpiry}
                invalid={!!errors.licenseExpiry}
                onChange={(e) => set('licenseExpiry', e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        {isAdmin && (
          <Field
            label="Usuário do sistema"
            htmlFor="dr-user"
            error={errors.userId}
            hint="Opcional. O usuário vinculado vê a própria agenda em “Minha agenda”."
          >
            <Select id="dr-user" value={form.userId} onChange={(e) => set('userId', e.target.value)} disabled={users.isPending}>
              <option value="">Sem vínculo</option>
              {(users.data ?? [])
                .filter((u) => u.isActive || u.id === form.userId)
                .map((u) => (
                  <option key={u.id} value={u.id} disabled={linkedUserIds.has(u.id)}>
                    {u.name} · {u.email}
                    {linkedUserIds.has(u.id) ? ' (já vinculado)' : ''}
                  </option>
                ))}
            </Select>
          </Field>
        )}
        {!isAdmin && driver?.userName && (
          <p className="text-sm text-ink-500">
            Vinculado ao usuário <strong className="text-ink-800">{driver.userName}</strong>.
          </p>
        )}

        <Field label="Observações" htmlFor="dr-notes" error={errors.notes}>
          <Textarea id="dr-notes" className="min-h-16" value={form.notes} maxLength={2000} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        {isEdit && (
          <Checkbox
            label="Ativo"
            description="Motoristas inativos não podem ser escalados."
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
          />
        )}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Veículo

const emptyVehicle = { plate: '', brand: '', model: '', year: '', color: '', capacity: '4', odometerKm: '0', notes: '', isActive: true }
const PLATE_RE = /^[A-Z]{3}-?[0-9][A-Z0-9][0-9]{2}$/

export function VehicleFormModal({ open, onClose, vehicle }: { open: boolean; onClose: () => void; vehicle?: Vehicle | null }) {
  const toast = useToast()
  const save = useSaveVehicle()
  const isEdit = !!vehicle
  const [form, setForm] = useState(emptyVehicle)
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      vehicle
        ? {
            plate: formatPlate(vehicle.plate),
            brand: vehicle.brand ?? '',
            model: vehicle.model,
            year: vehicle.year ? String(vehicle.year) : '',
            color: vehicle.color ?? '',
            capacity: String(vehicle.capacity),
            odometerKm: String(vehicle.odometerKm),
            notes: vehicle.notes ?? '',
            isActive: vehicle.isActive,
          }
        : emptyVehicle,
    )
  }, [open, vehicle])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const plateOk = PLATE_RE.test(form.plate)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!plateOk) errs.plate = 'Placa inválida (ex.: ABC1D23 ou ABC-1234).'
    if (!form.model.trim()) errs.model = 'Informe o modelo.'
    const capacity = Number(form.capacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) errs.capacity = 'De 1 a 100 lugares.'
    if (form.year && (Number(form.year) < 1950 || Number(form.year) > 2100)) errs.year = 'Ano inválido.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await save.mutateAsync({
        id: vehicle?.id,
        body: {
          plate: form.plate,
          brand: form.brand.trim() || undefined,
          model: form.model.trim(),
          year: form.year ? Number(form.year) : null,
          color: form.color.trim() || undefined,
          capacity,
          odometerKm: form.odometerKm ? Number(form.odometerKm) : 0,
          notes: form.notes.trim() || undefined,
          isActive: form.isActive,
        },
      })
      toast.success(isEdit ? 'Veículo atualizado.' : 'Veículo cadastrado.')
      onClose()
    } catch (err) {
      applyApiError(err, setErrors, toast)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Editar veículo' : 'Novo veículo'}
      footer={<Footer onClose={onClose} form="vehicle-form" loading={save.isPending} label={isEdit ? 'Salvar' : 'Cadastrar'} />}
    >
      <form id="vehicle-form" onSubmit={submit} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Field label="Placa" htmlFor="vh-plate" required error={errors.plate} className="sm:w-48">
            <Input
              id="vh-plate"
              value={form.plate}
              className="font-mono tracking-widest uppercase"
              placeholder="ABC1D23"
              invalid={!!errors.plate}
              onChange={(e) => set('plate', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8))}
            />
          </Field>
          <div className="flex h-[3.25rem] items-center sm:pb-0.5">
            {plateOk ? <Plate plate={form.plate} size="lg" /> : <span className="text-xs text-ink-400">Prévia da placa</span>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Marca" htmlFor="vh-brand">
            <Input id="vh-brand" value={form.brand} maxLength={100} onChange={(e) => set('brand', e.target.value)} />
          </Field>
          <Field label="Modelo" htmlFor="vh-model" required error={errors.model}>
            <Input id="vh-model" value={form.model} maxLength={100} invalid={!!errors.model} onChange={(e) => set('model', e.target.value)} />
          </Field>
          <Field label="Cor" htmlFor="vh-color">
            <Input id="vh-color" value={form.color} maxLength={50} onChange={(e) => set('color', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ano" htmlFor="vh-year" error={errors.year}>
            <Input id="vh-year" type="number" min={1950} max={2100} value={form.year} invalid={!!errors.year} onChange={(e) => set('year', e.target.value)} />
          </Field>
          <Field label="Passageiros" htmlFor="vh-cap" required error={errors.capacity} hint="Sem contar o motorista.">
            <Input
              id="vh-cap"
              type="number"
              min={1}
              max={100}
              value={form.capacity}
              invalid={!!errors.capacity}
              onChange={(e) => set('capacity', e.target.value)}
            />
          </Field>
          <Field
            label="Odômetro (km)"
            htmlFor="vh-odo"
            error={errors.odometerKm}
            hint={isEdit ? 'Avança sozinho ao concluir viagens.' : undefined}
          >
            <Input id="vh-odo" type="number" min={0} value={form.odometerKm} onChange={(e) => set('odometerKm', e.target.value)} />
          </Field>
        </div>
        <Field label="Observações" htmlFor="vh-notes">
          <Textarea id="vh-notes" className="min-h-16" value={form.notes} maxLength={2000} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {isEdit && (
          <Checkbox
            label="Ativo"
            description="Veículos inativos não podem ser escalados."
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
          />
        )}
      </form>
    </Modal>
  )
}
