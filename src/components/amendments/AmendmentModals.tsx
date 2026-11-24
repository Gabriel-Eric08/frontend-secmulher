import { useEffect, useState, type FormEvent } from 'react'
import { Hourglass, OctagonAlert } from 'lucide-react'
import clsx from 'clsx'
import { ApiError, type Amendment, type AmendmentPendency, type AmendmentSector, type PendencyKind } from '@/api'
import {
  useAddAmendmentNote,
  useCancelAmendment,
  useCompleteAmendment,
  useOpenPendency,
  useReopenAmendment,
  useResolvePendency,
  useSaveAmendmentSector,
} from '@/queries/amendments'
import { amendmentTitle } from '@/lib/amendments'
import { formatDateTimeLocal, toLocalDateTime, trimSeconds } from '@/lib/fleet'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Form'
import { Alert } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'

type Errors = Record<string, string>

export type AmendmentAction = 'note' | 'pendency' | 'complete' | 'cancel' | 'reopen'

function useErrorHandler() {
  const toast = useToast()
  return (err: unknown, setErrors: (e: Errors) => void) => {
    if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
    else toast.error(err)
  }
}

function Footer({ onClose, form, loading, label, danger }: { onClose: () => void; form: string; loading: boolean; label: string; danger?: boolean }) {
  return (
    <>
      <Button variant="secondary" onClick={onClose}>
        Voltar
      </Button>
      <Button type="submit" form={form} loading={loading} variant={danger ? 'danger' : 'primary'}>
        {label}
      </Button>
    </>
  )
}

/** Data/hora em que aconteceu: padrão agora, nunca no futuro (o backend recusa). */
function WhenField({ id, label, value, onChange, error, min }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; min?: string }) {
  return (
    <Field label={label} htmlFor={id} error={error} hint="Pode ser anterior ao registro. Não pode ser no futuro.">
      <Input id={id} type="datetime-local" value={value} min={min} max={toLocalDateTime(new Date())} invalid={!!error} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

const isFuture = (v: string) => !!v && v > toLocalDateTime(new Date())

export function AmendmentActionModal({ amendment, action, onClose }: { amendment: Amendment; action: AmendmentAction | null; onClose: () => void }) {
  if (action === 'note') return <NoteModal amendment={amendment} onClose={onClose} />
  if (action === 'pendency') return <PendencyModal amendment={amendment} onClose={onClose} />
  if (action === 'complete') return <CompleteModal amendment={amendment} onClose={onClose} />
  if (action === 'cancel' || action === 'reopen') return <ReasonModal amendment={amendment} mode={action} onClose={onClose} />
  return null
}

// ---------------------------------------------------------------- Anotação

function NoteModal({ amendment, onClose }: { amendment: Amendment; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const add = useAddAmendmentNote()
  const [description, setDescription] = useState('')
  const [at, setAt] = useState(() => toLocalDateTime(new Date()))
  const [errors, setErrors] = useState<Errors>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return setErrors({ description: 'Escreva a anotação.' })
    if (isFuture(at)) return setErrors({ occurredAt: 'Não pode ser no futuro.' })
    try {
      await add.mutateAsync({ id: amendment.id, body: { description: description.trim(), occurredAt: at || undefined } })
      toast.success('Anotação registrada.')
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nova anotação"
      description="Contatos, andamentos e combinados ficam na linha do tempo da emenda."
      footer={<Footer onClose={onClose} form="note-form" loading={add.isPending} label="Registrar" />}
    >
      <form id="note-form" onSubmit={submit} className="space-y-4">
        <Field label="Anotação" htmlFor="nt-desc" required error={errors.description}>
          <Textarea id="nt-desc" maxLength={10000} value={description} invalid={!!errors.description} placeholder="Ex.: Contato com a SEPLAG sobre o impedimento técnico" onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <WhenField id="nt-at" label="Quando aconteceu" value={at} onChange={setAt} error={errors.occurredAt} />
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Pendência

const KIND_OPTIONS: { kind: PendencyKind; label: string; hint: string; Icon: typeof Hourglass; tone: string }[] = [
  { kind: 'WAITING', label: 'Espera', hint: 'A emenda aguarda algo ou alguém (ex.: documento do beneficiário).', Icon: Hourglass, tone: 'amber' },
  { kind: 'IMPEDIMENT', label: 'Impedimento', hint: 'Algo impede o andamento (ex.: impedimento técnico da SEPLAG).', Icon: OctagonAlert, tone: 'red' },
]

function PendencyModal({ amendment, onClose }: { amendment: Amendment; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const open = useOpenPendency()
  const [kind, setKind] = useState<PendencyKind>('WAITING')
  const [description, setDescription] = useState('')
  const [waitingOn, setWaitingOn] = useState('')
  const [at, setAt] = useState(() => toLocalDateTime(new Date()))
  const [errors, setErrors] = useState<Errors>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return setErrors({ description: 'Descreva a pendência.' })
    if (isFuture(at)) return setErrors({ openedAt: 'Não pode ser no futuro.' })
    try {
      await open.mutateAsync({
        id: amendment.id,
        body: { kind, description: description.trim(), waitingOn: waitingOn.trim() || undefined, openedAt: at || undefined },
      })
      toast.success(kind === 'IMPEDIMENT' ? 'Impedimento registrado.' : 'Espera registrada.')
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Abrir pendência"
      description="Enquanto houver pendência aberta, a emenda não pode ser concluída."
      footer={<Footer onClose={onClose} form="pendency-form" loading={open.isPending} label="Abrir pendência" />}
    >
      <form id="pendency-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo da pendência">
          {KIND_OPTIONS.map((o) => (
            <button
              key={o.kind}
              type="button"
              role="radio"
              aria-checked={kind === o.kind}
              onClick={() => setKind(o.kind)}
              className={clsx(
                'rounded-xl border p-3 text-left transition-colors',
                kind === o.kind
                  ? o.tone === 'red'
                    ? 'border-red-300 bg-red-50 ring-1 ring-red-200'
                    : 'border-amber-300 bg-amber-50 ring-1 ring-amber-200'
                  : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
              )}
            >
              <span className={clsx('flex items-center gap-2 text-sm font-medium', o.tone === 'red' ? 'text-red-700' : 'text-amber-800')}>
                <o.Icon className="size-4" /> {o.label}
              </span>
              <span className="mt-1 block text-xs text-ink-500">{o.hint}</span>
            </button>
          ))}
        </div>
        <Field label={kind === 'IMPEDIMENT' ? 'O que impede' : 'O que está sendo aguardado'} htmlFor="pd-desc" required error={errors.description}>
          <Textarea id="pd-desc" className="min-h-20" maxLength={10000} value={description} invalid={!!errors.description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Depende de" htmlFor="pd-on" error={errors.waitingOn} hint="De quem ou de quê (ex.: SEPLAG, Beneficiário).">
            <Input id="pd-on" maxLength={255} value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} />
          </Field>
          <WhenField id="pd-at" label="Aberta em" value={at} onChange={setAt} error={errors.openedAt} />
        </div>
      </form>
    </Modal>
  )
}

export function ResolvePendencyModal({ pendency, onClose }: { pendency: AmendmentPendency; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const resolve = useResolvePendency()
  const [resolution, setResolution] = useState('')
  const [at, setAt] = useState(() => toLocalDateTime(new Date()))
  const [errors, setErrors] = useState<Errors>({})
  const openedAt = trimSeconds(pendency.openedAt)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!resolution.trim()) return setErrors({ resolution: 'Informe como foi resolvida.' })
    if (isFuture(at)) return setErrors({ resolvedAt: 'Não pode ser no futuro.' })
    if (at && at < openedAt) return setErrors({ resolvedAt: 'Não pode ser antes da abertura.' })
    try {
      await resolve.mutateAsync({
        id: pendency.amendmentId,
        pendencyId: pendency.id,
        body: { resolution: resolution.trim(), resolvedAt: at || undefined },
      })
      toast.success('Pendência resolvida.')
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Resolver pendência"
      description={pendency.description}
      footer={<Footer onClose={onClose} form="resolve-form" loading={resolve.isPending} label="Resolver" />}
    >
      <form id="resolve-form" onSubmit={submit} className="space-y-4">
        <Field label="Como foi resolvida" htmlFor="rs-res" required error={errors.resolution}>
          <Textarea id="rs-res" className="min-h-20" maxLength={10000} value={resolution} invalid={!!errors.resolution} placeholder="Ex.: Certidões entregues" onChange={(e) => setResolution(e.target.value)} />
        </Field>
        <WhenField id="rs-at" label="Resolvida em" value={at} min={openedAt} onChange={setAt} error={errors.resolvedAt} />
        <p className="text-xs text-ink-500">Aberta em {formatDateTimeLocal(pendency.openedAt)}.</p>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Conclusão

function CompleteModal({ amendment, onClose }: { amendment: Amendment; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const complete = useCompleteAmendment()
  const [description, setDescription] = useState('')
  const [at, setAt] = useState(() => toLocalDateTime(new Date()))
  const [errors, setErrors] = useState<Errors>({})
  const blocked = amendment.openPendencies > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (isFuture(at)) return setErrors({ completedAt: 'Não pode ser no futuro.' })
    try {
      await complete.mutateAsync({ id: amendment.id, body: { description: description.trim() || undefined, completedAt: at || undefined } })
      toast.success('Emenda concluída.')
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Concluir emenda"
      description={amendmentTitle(amendment)}
      footer={
        blocked ? (
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
        ) : (
          <Footer onClose={onClose} form="complete-form" loading={complete.isPending} label="Concluir" />
        )
      }
    >
      {blocked ? (
        <Alert tone="warning" title="Há pendências abertas">
          Resolva as {amendment.openPendencies} pendência(s) aberta(s) antes de concluir.
        </Alert>
      ) : (
        <form id="complete-form" onSubmit={submit} className="space-y-4">
          <Field label="Observação" htmlFor="cp-desc" error={errors.description}>
            <Textarea id="cp-desc" className="min-h-20" maxLength={10000} value={description} placeholder="Ex.: Pagamento efetuado" onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <WhenField id="cp-at" label="Concluída em" value={at} onChange={setAt} error={errors.completedAt} />
        </form>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------- Cancelar / reabrir

function ReasonModal({ amendment, mode, onClose }: { amendment: Amendment; mode: 'cancel' | 'reopen'; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const cancel = useCancelAmendment()
  const reopen = useReopenAmendment()
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const isCancel = mode === 'cancel'
  const pending = isCancel ? cancel.isPending : reopen.isPending

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return setErrors({ reason: 'Informe o motivo.' })
    try {
      const fn = isCancel ? cancel : reopen
      await fn.mutateAsync({ id: amendment.id, reason: reason.trim() })
      toast.success(isCancel ? 'Emenda cancelada.' : 'Emenda reaberta.')
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isCancel ? 'Cancelar emenda' : 'Reabrir emenda'}
      description={
        isCancel
          ? `As pendências abertas serão encerradas.${amendment.openPendencies ? ` (${amendment.openPendencies} aberta(s))` : ''} É possível reabrir depois.`
          : 'A emenda volta para o acompanhamento e pode ser editada de novo.'
      }
      footer={<Footer onClose={onClose} form="reason-form" loading={pending} label={isCancel ? 'Cancelar emenda' : 'Reabrir'} danger={isCancel} />}
    >
      <form id="reason-form" onSubmit={submit}>
        <Field label="Motivo" htmlFor="rz-reason" required error={errors.reason}>
          <Textarea id="rz-reason" maxLength={10000} value={reason} invalid={!!errors.reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Setor

export function SectorFormModal({ open, onClose, sector }: { open: boolean; onClose: () => void; sector?: AmendmentSector | null }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const save = useSaveAmendmentSector()
  const isEdit = !!sector
  const [form, setForm] = useState({ name: '', description: '', isActive: true })
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(sector ? { name: sector.name, description: sector.description ?? '', isActive: sector.isActive } : { name: '', description: '', isActive: true })
  }, [open, sector])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setErrors({ name: 'Informe o nome.' })
    try {
      await save.mutateAsync({
        id: sector?.id,
        body: { name: form.name.trim(), description: form.description.trim() || undefined, ...(isEdit ? { isActive: form.isActive } : {}) },
      })
      toast.success(isEdit ? 'Setor atualizado.' : 'Setor criado.')
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) setErrors({ name: 'Já existe um setor com esse nome.' })
      else handle(err, setErrors)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar setor' : 'Novo setor'}
      footer={<Footer onClose={onClose} form="sector-form" loading={save.isPending} label={isEdit ? 'Salvar' : 'Criar setor'} />}
    >
      <form id="sector-form" onSubmit={submit} className="space-y-4">
        <Field label="Nome" htmlFor="sc-name" required error={errors.name}>
          <Input id="sc-name" maxLength={255} value={form.name} invalid={!!errors.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
        <Field label="Descrição" htmlFor="sc-desc" error={errors.description}>
          <Textarea id="sc-desc" className="min-h-20" maxLength={2000} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>
        {isEdit && (
          <Checkbox
            label="Setor ativo"
            description="Setor inativo não recebe novas emendas."
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
        )}
      </form>
    </Modal>
  )
}
