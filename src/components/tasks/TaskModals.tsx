import { useEffect, useMemo, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Hourglass, OctagonAlert, Pause, Play } from 'lucide-react'
import { ApiError, type Goal, type Task, type TaskPendency, type TaskPendencyKind, type TaskPriority, type TaskUserRef, type UUID } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useUsers } from '@/queries/admin'
import {
  useAddGoalNote,
  useAddTaskNote,
  useCancelGoal,
  useCancelTask,
  useCompleteGoal,
  useCompleteTask,
  useHoldGoal,
  useHoldTask,
  useOpenTaskPendency,
  useReopenGoal,
  useReopenTask,
  useResolveTaskPendency,
  useResumeGoal,
  useResumeTask,
  useSaveGoal,
  useSaveTask,
  useStartTask,
  useTaskOptions,
  useTaskPendencies,
} from '@/queries/tasks'
import { PRIORITIES, PRIORITY_LABEL } from '@/lib/tasks'
import { formatDateTimeLocal, toLocalDateTime, trimSeconds } from '@/lib/fleet'
import { formatDate, normalize } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Alert, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { ResponsibleInput } from './ResponsibleInput'
import { useToast } from '@/components/ui/Toast'

type Errors = Record<string, string>

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

// ---------------------------------------------------------------- Seleção de usuário

/**
 * A lista completa de usuários só a administração enxerga. Para os demais, as opções são
 * quem já é responsável ou dono de meta (de /tasks/options) e o próprio usuário.
 */
function UserSelect({ id, value, onChange, current, invalid }: { id: string; value: string; onChange: (v: string) => void; current?: TaskUserRef | null; invalid?: boolean }) {
  const { user, isAdmin } = useAuth()
  const users = useUsers(isAdmin)
  const options = useTaskOptions(undefined, !isAdmin)

  const list = useMemo(() => {
    const map = new Map<string, string>()
    if (isAdmin) (users.data ?? []).filter((u) => u.isActive).forEach((u) => map.set(u.id, u.name))
    else [...(options.data?.responsibleUsers ?? []), ...(options.data?.goalOwners ?? [])].forEach((u) => map.set(u.id, u.name))
    if (user) map.set(user.id, user.name)
    if (current) map.set(current.id, current.name)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [isAdmin, users.data, options.data, user, current])

  return (
    <Select id={id} value={value} invalid={invalid} onChange={(e) => onChange(e.target.value)}>
      <option value="">Ninguém</option>
      {list.map(([uid, name]) => (
        <option key={uid} value={uid}>
          {name}
          {uid === user?.id ? ' (eu)' : ''}
        </option>
      ))}
    </Select>
  )
}

// ---------------------------------------------------------------- Meta: cadastro e edição

export function GoalFormModal({ open, onClose, goal, onSaved }: { open: boolean; onClose: () => void; goal?: Goal | null; onSaved?: (g: Goal) => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const save = useSaveGoal()
  const isEdit = !!goal
  const empty = { title: '', description: '', ownerUserId: '', startDate: '', dueDate: '', comment: '' }
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState<Errors>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      goal
        ? {
            title: goal.title,
            description: goal.description ?? '',
            ownerUserId: goal.owner?.id ?? '',
            startDate: goal.startDate ?? '',
            dueDate: goal.dueDate ?? '',
            comment: '',
          }
        : empty,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal])

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!form.title.trim()) errs.title = 'Informe o título.'
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) errs.dueDate = 'O prazo não pode ser antes do início.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      const saved = await save.mutateAsync({
        id: goal?.id,
        body: {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          ownerUserId: form.ownerUserId || null,
          startDate: form.startDate || null,
          dueDate: form.dueDate || null,
          ...(isEdit && form.comment.trim() ? { comment: form.comment.trim() } : {}),
        },
      })
      toast.success(isEdit ? 'Meta atualizada.' : 'Meta criada.')
      onClose()
      onSaved?.(saved)
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Editar meta' : 'Nova meta'}
      description="A meta reúne as tarefas; o progresso é calculado pelas tarefas concluídas."
      footer={<Footer onClose={onClose} form="goal-form" loading={save.isPending} label={isEdit ? 'Salvar' : 'Criar meta'} />}
    >
      <form id="goal-form" onSubmit={submit} className="space-y-4">
        <Field label="Título" htmlFor="gl-title" required error={errors.title}>
          <Input id="gl-title" maxLength={255} autoFocus value={form.title} invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Descrição" htmlFor="gl-desc" error={errors.description}>
          <Textarea id="gl-desc" className="min-h-24" maxLength={10000} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Responsável pela meta" htmlFor="gl-owner" error={errors.ownerUserId} hint="Acompanha todas as tarefas da meta." className="sm:col-span-3">
            <UserSelect id="gl-owner" value={form.ownerUserId} current={goal?.owner} invalid={!!errors.ownerUserId} onChange={(v) => set('ownerUserId', v)} />
          </Field>
          <Field label="Início previsto" htmlFor="gl-start" error={errors.startDate}>
            <Input id="gl-start" type="date" value={form.startDate} invalid={!!errors.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="Prazo" htmlFor="gl-due" error={errors.dueDate}>
            <Input id="gl-due" type="date" min={form.startDate || undefined} value={form.dueDate} invalid={!!errors.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </Field>
        </div>
        {isEdit && (
          <Field label="Comentário da alteração" htmlFor="gl-comment" hint="Vai para o histórico junto com o que mudou.">
            <Input id="gl-comment" maxLength={2000} value={form.comment} onChange={(e) => set('comment', e.target.value)} />
          </Field>
        )}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Tarefa / subtarefa: cadastro e edição

export function TaskFormModal({
  open,
  onClose,
  task,
  goalId,
  parent,
  parentDueDate,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  /** Edição */
  task?: Task | null
  /** Nova tarefa nesta meta */
  goalId?: UUID
  /** Nova subtarefa desta tarefa */
  parent?: Pick<Task, 'id' | 'title' | 'dueDate'> | null
  /** Edição de subtarefa: prazo da tarefa-mãe */
  parentDueDate?: string | null
  onSaved?: (t: Task) => void
}) {
  const toast = useToast()
  const handle = useErrorHandler()
  const save = useSaveTask()
  const isEdit = !!task
  const isSub = isEdit ? task.subtask : !!parent
  const empty = { title: '', description: '', priority: 'MEDIUM' as TaskPriority, startDate: '', dueDate: '', responsibleName: '', comment: '' }
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState<Errors>({})
  const { user } = useAuth()
  const options = useTaskOptions(undefined, open)
  // Prazo da subtarefa não passa do prazo da tarefa-mãe (o backend também confere)
  const parentDue = parent?.dueDate ?? parentDueDate ?? null

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      task
        ? {
            title: task.title,
            description: task.description ?? '',
            priority: task.priority,
            startDate: task.startDate ?? '',
            dueDate: task.dueDate ?? '',
            responsibleName: task.responsibleName ?? task.responsibleUser?.name ?? '',
            comment: '',
          }
        : empty,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const noun = isSub ? 'subtarefa' : 'tarefa'

  /**
   * Responsável é texto livre. Quando o nome bate com um usuário conhecido (eu, quem já é
   * responsável ou dono de meta), vincula também o usuário: é isso que dá as permissões de
   * responsável e faz a tarefa aparecer em "minhas tarefas".
   */
  const linkedUserId = (name: string): UUID | null => {
    const key = normalize(name)
    if (!key) return null
    const known = new Map<string, string>()
    ;[...(options.data?.responsibleUsers ?? []), ...(options.data?.goalOwners ?? [])].forEach((u) => known.set(u.id, u.name))
    if (task?.responsibleUser) known.set(task.responsibleUser.id, task.responsibleUser.name)
    if (user) known.set(user.id, user.name)
    const hits = [...known].filter(([, n]) => normalize(n) === key)
    return hits.length === 1 ? hits[0][0] : null
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!form.title.trim()) errs.title = 'Informe o título.'
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) errs.dueDate = 'O prazo não pode ser antes do início.'
    else if (parentDue && form.dueDate && form.dueDate > parentDue) errs.dueDate = `Não pode passar do prazo da tarefa-mãe (${formatDate(parentDue)}).`
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      const saved = await save.mutateAsync({
        id: task?.id,
        body: {
          ...(isEdit ? {} : parent ? { parentId: parent.id } : { goalId }),
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          priority: form.priority,
          startDate: form.startDate || null,
          dueDate: form.dueDate || null,
          responsibleName: form.responsibleName.trim() || null,
          responsibleUserId: linkedUserId(form.responsibleName.trim()),
          ...(isEdit && form.comment.trim() ? { comment: form.comment.trim() } : {}),
        },
      })
      toast.success(isEdit ? `${isSub ? 'Subtarefa' : 'Tarefa'} atualizada.` : `${isSub ? 'Subtarefa' : 'Tarefa'} criada.`)
      onClose()
      onSaved?.(saved)
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Editar ${noun}` : `Nova ${noun}`}
      description={!isEdit && parent ? `Subtarefa de “${parent.title}”` : undefined}
      footer={<Footer onClose={onClose} form="task-form" loading={save.isPending} label={isEdit ? 'Salvar' : `Criar ${noun}`} />}
    >
      <form id="task-form" onSubmit={submit} className="space-y-4">
        <Field label="Título" htmlFor="tk-title" required error={errors.title}>
          <Input id="tk-title" maxLength={255} autoFocus value={form.title} invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Descrição" htmlFor="tk-desc" error={errors.description}>
          <Textarea id="tk-desc" className="min-h-20" maxLength={10000} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Responsável" htmlFor="tk-resp" error={errors.responsibleName ?? errors.responsibleUserId} hint="Digite o nome; aparecem os já usados em outras tarefas.">
            <ResponsibleInput
              id="tk-resp"
              value={form.responsibleName}
              suggestions={options.data?.responsibleNames ?? []}
              invalid={!!(errors.responsibleName ?? errors.responsibleUserId)}
              onChange={(v) => set('responsibleName', v)}
            />
          </Field>
          <Field label="Prioridade" htmlFor="tk-prio" error={errors.priority}>
            <Select id="tk-prio" value={form.priority} onChange={(e) => set('priority', e.target.value as TaskPriority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Início previsto" htmlFor="tk-start" error={errors.startDate}>
            <Input id="tk-start" type="date" value={form.startDate} invalid={!!errors.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="Prazo" htmlFor="tk-due" error={errors.dueDate} hint={parentDue ? `Até ${formatDate(parentDue)} (prazo da tarefa-mãe).` : undefined}>
            <Input
              id="tk-due"
              type="date"
              min={form.startDate || undefined}
              max={parentDue ?? undefined}
              value={form.dueDate}
              invalid={!!errors.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
            />
          </Field>
        </div>
        {isEdit && (
          <Field label="Comentário da alteração" htmlFor="tk-comment" hint="Vai para o histórico junto com o que mudou.">
            <Input id="tk-comment" maxLength={2000} value={form.comment} onChange={(e) => set('comment', e.target.value)} />
          </Field>
        )}
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Ações de acompanhamento

export type TrackAction = 'note' | 'start' | 'pendency' | 'hold' | 'resume' | 'complete' | 'cancel' | 'reopen'

export type TrackTarget = { kind: 'goal'; goal: Goal } | { kind: 'task'; task: Task }

const targetId = (t: TrackTarget) => (t.kind === 'goal' ? t.goal.id : t.task.id)
const targetTitle = (t: TrackTarget) => (t.kind === 'goal' ? t.goal.title : t.task.title)
const targetNoun = (t: TrackTarget) => (t.kind === 'goal' ? 'meta' : t.task.subtask ? 'subtarefa' : 'tarefa')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function TrackActionModal({ target, action, onClose }: { target: TrackTarget; action: TrackAction | null; onClose: () => void }) {
  switch (action) {
    case 'note':
      return <NoteModal target={target} onClose={onClose} />
    case 'start':
      return target.kind === 'task' ? <StartModal task={target.task} onClose={onClose} /> : null
    case 'pendency':
      return target.kind === 'task' ? <PendencyModal task={target.task} onClose={onClose} /> : null
    case 'complete':
      return <CompleteModal target={target} onClose={onClose} />
    case 'resume':
      return <ResumeModal target={target} onClose={onClose} />
    case 'hold':
    case 'cancel':
    case 'reopen':
      return <ReasonModal target={target} mode={action} onClose={onClose} />
    default:
      return null
  }
}

function NoteModal({ target, onClose }: { target: TrackTarget; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const goalNote = useAddGoalNote()
  const taskNote = useAddTaskNote()
  const m = target.kind === 'goal' ? goalNote : taskNote
  const [description, setDescription] = useState('')
  const [at, setAt] = useState(() => toLocalDateTime(new Date()))
  const [errors, setErrors] = useState<Errors>({})

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return setErrors({ description: 'Escreva a anotação.' })
    if (isFuture(at)) return setErrors({ occurredAt: 'Não pode ser no futuro.' })
    try {
      await m.mutateAsync({ id: targetId(target), body: { description: description.trim(), occurredAt: at || undefined } })
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
      description={`Andamentos e combinados ficam no histórico da ${targetNoun(target)}.`}
      footer={<Footer onClose={onClose} form="tk-note-form" loading={m.isPending} label="Registrar" />}
    >
      <form id="tk-note-form" onSubmit={submit} className="space-y-4">
        <Field label="Anotação" htmlFor="tn-desc" required error={errors.description}>
          <Textarea id="tn-desc" autoFocus maxLength={10000} value={description} invalid={!!errors.description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <WhenField id="tn-at" label="Quando aconteceu" value={at} onChange={setAt} error={errors.occurredAt} />
      </form>
    </Modal>
  )
}

function StartModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const start = useStartTask()
  const [description, setDescription] = useState('')
  const [at, setAt] = useState(() => toLocalDateTime(new Date()))
  const [errors, setErrors] = useState<Errors>({})
  const startsParent = task.subtask && task.parent?.status === 'TODO'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (isFuture(at)) return setErrors({ startedAt: 'Não pode ser no futuro.' })
    try {
      await start.mutateAsync({ id: task.id, body: { description: description.trim() || undefined, startedAt: at || undefined } })
      toast.success(`${task.subtask ? 'Subtarefa' : 'Tarefa'} iniciada.`)
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Iniciar ${task.subtask ? 'subtarefa' : 'tarefa'}`}
      description={task.title}
      footer={<Footer onClose={onClose} form="tk-start-form" loading={start.isPending} label="Iniciar" />}
    >
      <form id="tk-start-form" onSubmit={submit} className="space-y-4">
        {startsParent && (
          <Alert tone="info" title="A tarefa-mãe também será iniciada">
            “{task.parent?.title}” ainda não foi iniciada.
          </Alert>
        )}
        <Field label="Observação" htmlFor="ts-desc">
          <Textarea id="ts-desc" className="min-h-20" maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <WhenField id="ts-at" label="Iniciada em" value={at} onChange={setAt} error={errors.startedAt} />
      </form>
    </Modal>
  )
}

const KIND_OPTIONS: { kind: TaskPendencyKind; label: string; hint: string; Icon: typeof Hourglass; tone: 'amber' | 'red' }[] = [
  { kind: 'WAITING', label: 'Espera', hint: 'A tarefa aguarda algo ou alguém (ex.: resposta de outro setor).', Icon: Hourglass, tone: 'amber' },
  { kind: 'IMPEDIMENT', label: 'Impedimento', hint: 'Algo impede o andamento.', Icon: OctagonAlert, tone: 'red' },
]

function PendencyModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const open = useOpenTaskPendency()
  const [kind, setKind] = useState<TaskPendencyKind>('WAITING')
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
        id: task.id,
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
      description="Enquanto houver pendência aberta, a tarefa não pode ser concluída."
      footer={<Footer onClose={onClose} form="tk-pendency-form" loading={open.isPending} label="Abrir pendência" />}
    >
      <form id="tk-pendency-form" onSubmit={submit} className="space-y-4">
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
        <Field label={kind === 'IMPEDIMENT' ? 'O que impede' : 'O que está sendo aguardado'} htmlFor="tp-desc" required error={errors.description}>
          <Textarea id="tp-desc" className="min-h-20" maxLength={10000} value={description} invalid={!!errors.description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Depende de" htmlFor="tp-on" error={errors.waitingOn} hint="De quem ou de quê (ex.: Jurídico, Fornecedor).">
            <Input id="tp-on" maxLength={255} value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} />
          </Field>
          <WhenField id="tp-at" label="Aberta em" value={at} onChange={setAt} error={errors.openedAt} />
        </div>
      </form>
    </Modal>
  )
}

export function ResolveTaskPendencyModal({ pendency, onClose }: { pendency: TaskPendency; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const resolve = useResolveTaskPendency()
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
      await resolve.mutateAsync({ id: pendency.taskId, pendencyId: pendency.id, body: { resolution: resolution.trim(), resolvedAt: at || undefined } })
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
      footer={<Footer onClose={onClose} form="tk-resolve-form" loading={resolve.isPending} label="Resolver" />}
    >
      <form id="tk-resolve-form" onSubmit={submit} className="space-y-4">
        <Field label="Como foi resolvida" htmlFor="tr-res" required error={errors.resolution}>
          <Textarea id="tr-res" autoFocus className="min-h-20" maxLength={10000} value={resolution} invalid={!!errors.resolution} onChange={(e) => setResolution(e.target.value)} />
        </Field>
        <WhenField id="tr-at" label="Resolvida em" value={at} min={openedAt} onChange={setAt} error={errors.resolvedAt} />
        <p className="text-xs text-ink-500">Aberta em {formatDateTimeLocal(pendency.openedAt)}.</p>
      </form>
    </Modal>
  )
}

/** O que ainda impede a conclusão (o backend confere de novo). */
function completionBlockers(target: TrackTarget, openTasks?: number): string[] {
  if (target.kind === 'goal') {
    return openTasks ? [`${openTasks} tarefa(s) ou subtarefa(s) ainda aberta(s). Conclua ou cancele antes.`] : []
  }
  const t = target.task
  const out: string[] = []
  if (t.openPendencies > 0) out.push(`${t.openPendencies} pendência(s) aberta(s). Resolva antes de concluir.`)
  const openSubs = (t.subtasks ?? []).filter((s) => s.status !== 'COMPLETED' && s.status !== 'CANCELLED').length
  if (openSubs > 0) out.push(`${openSubs} subtarefa(s) aberta(s). Conclua ou cancele antes.`)
  return out
}

function CompleteModal({ target, onClose }: { target: TrackTarget; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const goalComplete = useCompleteGoal()
  const taskComplete = useCompleteTask()
  const m = target.kind === 'goal' ? goalComplete : taskComplete
  const [description, setDescription] = useState('')
  const [at, setAt] = useState(() => toLocalDateTime(new Date()))
  const [errors, setErrors] = useState<Errors>({})
  const noun = targetNoun(target)
  // Na meta, `progress` conta só tarefas: subtarefas abertas o backend confere
  const openTasks = target.kind === 'goal' ? target.goal.progress.total - target.goal.progress.completed - target.goal.progress.cancelled : 0
  const blockers = completionBlockers(target, openTasks)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (isFuture(at)) return setErrors({ completedAt: 'Não pode ser no futuro.' })
    try {
      await m.mutateAsync({ id: targetId(target), body: { description: description.trim() || undefined, completedAt: at || undefined } })
      toast.success(`${cap(noun)} concluída.`)
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Concluir ${noun}`}
      description={targetTitle(target)}
      footer={
        blockers.length ? (
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
        ) : (
          <Footer onClose={onClose} form="tk-complete-form" loading={m.isPending} label="Concluir" />
        )
      }
    >
      {blockers.length ? (
        <Alert tone="warning" title="Ainda não dá para concluir">
          <ul className="list-disc space-y-0.5 pl-4">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <form id="tk-complete-form" onSubmit={submit} className="space-y-4">
          <Field label="Observação" htmlFor="tc-desc" error={errors.description}>
            <Textarea id="tc-desc" className="min-h-20" maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <WhenField id="tc-at" label="Concluída em" value={at} onChange={setAt} error={errors.completedAt} />
        </form>
      )}
    </Modal>
  )
}

function ResumeModal({ target, onClose }: { target: TrackTarget; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const goalResume = useResumeGoal()
  const taskResume = useResumeTask()
  const m = target.kind === 'goal' ? goalResume : taskResume
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const noun = targetNoun(target)
  const holdReason = target.kind === 'goal' ? target.goal.holdReason : target.task.holdReason

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await m.mutateAsync({ id: targetId(target), description: description.trim() || undefined })
      toast.success(`${cap(noun)} retomada.`)
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Retomar ${noun}`}
      description={holdReason ? `Pausada: ${holdReason}` : targetTitle(target)}
      footer={<Footer onClose={onClose} form="tk-resume-form" loading={m.isPending} label="Retomar" />}
    >
      <form id="tk-resume-form" onSubmit={submit}>
        <Field label="Comentário" htmlFor="tu-desc" error={errors.description}>
          <Textarea id="tu-desc" maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

function ReasonModal({ target, mode, onClose }: { target: TrackTarget; mode: 'hold' | 'cancel' | 'reopen'; onClose: () => void }) {
  const toast = useToast()
  const handle = useErrorHandler()
  const goalHold = useHoldGoal()
  const goalCancel = useCancelGoal()
  const goalReopen = useReopenGoal()
  const taskHold = useHoldTask()
  const taskCancel = useCancelTask()
  const taskReopen = useReopenTask()
  const isGoal = target.kind === 'goal'
  const m = {
    hold: isGoal ? goalHold : taskHold,
    cancel: isGoal ? goalCancel : taskCancel,
    reopen: isGoal ? goalReopen : taskReopen,
  }[mode]
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const noun = targetNoun(target)

  const copy = {
    hold: {
      title: `Pausar ${noun}`,
      description: isGoal ? 'A pausa marca só a meta; as tarefas continuam como estão.' : 'A pausa vale mais que as pendências até ser retomada.',
      label: 'Pausar',
      done: `${cap(noun)} pausada.`,
    },
    cancel: {
      title: `Cancelar ${noun}`,
      description: isGoal
        ? 'Todas as tarefas e subtarefas abertas serão canceladas. É possível reabrir a meta depois (as tarefas não reabrem sozinhas).'
        : `As pendências abertas serão encerradas${target.kind === 'task' && !target.task.subtask ? ' e as subtarefas abertas, canceladas' : ''}. É possível reabrir depois.`,
      label: `Cancelar ${noun}`,
      done: `${cap(noun)} cancelada.`,
    },
    reopen: {
      title: `Reabrir ${noun}`,
      description: `A ${noun} volta para o acompanhamento e pode ser editada de novo.`,
      label: 'Reabrir',
      done: `${cap(noun)} reaberta.`,
    },
  }[mode]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return setErrors({ reason: 'Informe o motivo.' })
    try {
      await m.mutateAsync({ id: targetId(target), reason: reason.trim() })
      toast.success(copy.done)
      onClose()
    } catch (err) {
      handle(err, setErrors)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={copy.title}
      description={copy.description}
      footer={<Footer onClose={onClose} form="tk-reason-form" loading={m.isPending} label={copy.label} danger={mode === 'cancel'} />}
    >
      <form id="tk-reason-form" onSubmit={submit}>
        <Field label="Motivo" htmlFor="tz-reason" required error={errors.reason}>
          <Textarea id="tz-reason" autoFocus maxLength={10000} value={reason} invalid={!!errors.reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------- Tirar do impedimento (quadro)

/**
 * A coluna "Com impedimento" junta pausa e pendências abertas. Para sair dela, é preciso
 * retomar a pausa e resolver as pendências; aqui ficam as duas coisas, uma de cada vez.
 */
export function UnblockModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const pendencies = useTaskPendencies(task.id)
  const [resuming, setResuming] = useState(false)
  const [resolving, setResolving] = useState<TaskPendency | null>(null)
  const open = (pendencies.data ?? []).filter((p) => p.open)
  const onHold = task.status === 'ON_HOLD'
  const clear = !onHold && !pendencies.isPending && open.length === 0

  return (
    <>
      <Modal
        open={!resuming && !resolving}
        onClose={onClose}
        title="Tirar do impedimento"
        description={task.title}
        footer={
          <Button variant={clear ? 'primary' : 'secondary'} onClick={onClose}>
            {clear ? 'Pronto' : 'Fechar'}
          </Button>
        }
      >
        <div className="space-y-3">
          {clear && (
            <Alert tone="info" title="Nada mais travando">
              A tarefa volta para {task.startedAt ? 'Em andamento' : 'A fazer'}.
            </Alert>
          )}
          {onHold && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <Pause className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <div className="min-w-0 flex-1 text-sm text-amber-900">
                <p className="font-medium">Pausada desde {formatDateTimeLocal(task.onHoldSince)}</p>
                {task.holdReason && <p className="opacity-80">{task.holdReason}</p>}
              </div>
              <Button size="sm" icon={<Play className="size-3.5" />} onClick={() => setResuming(true)}>
                Retomar
              </Button>
            </div>
          )}
          {pendencies.isPending ? (
            <LoadingBlock />
          ) : pendencies.isError ? (
            <ErrorState error={pendencies.error} onRetry={() => pendencies.refetch()} />
          ) : (
            open.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-xl border border-ink-200 px-4 py-3">
                {p.kind === 'IMPEDIMENT' ? (
                  <OctagonAlert className="mt-0.5 size-4 shrink-0 text-red-600" />
                ) : (
                  <Hourglass className="mt-0.5 size-4 shrink-0 text-amber-700" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-ink-900">{p.kindLabel}{p.waitingOn ? ` · ${p.waitingOn}` : ''}</p>
                  <p className="whitespace-pre-line text-ink-600">{p.description}</p>
                </div>
                <Button size="sm" variant="secondary" icon={<CheckCircle2 className="size-3.5" />} onClick={() => setResolving(p)}>
                  Resolver
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>
      {resuming && <ResumeModal target={{ kind: 'task', task }} onClose={() => setResuming(false)} />}
      {resolving && <ResolveTaskPendencyModal pendency={resolving} onClose={() => setResolving(null)} />}
    </>
  )
}
