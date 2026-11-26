import type { Access } from '@/auth/access'
import type {
  Goal,
  GoalSort,
  Task,
  TaskActivityKind,
  TaskDeadlineStatus,
  TaskGoalStatus,
  TaskPendencyKind,
  TaskPriority,
  TaskSort,
  TaskStatus,
  UUID,
} from '@/api'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

// ---------------------------------------------------------------- Situação da meta

export const GOAL_STATUSES: TaskGoalStatus[] = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']

export const GOAL_STATUS_LABEL: Record<TaskGoalStatus, string> = {
  ACTIVE: 'Em andamento',
  ON_HOLD: 'Pausada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
}

export const GOAL_STATUS_TONE: Record<TaskGoalStatus, Tone> = {
  ACTIVE: 'brand',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

export const isGoalClosed = (s: TaskGoalStatus) => s === 'COMPLETED' || s === 'CANCELLED'

// ---------------------------------------------------------------- Situação da tarefa

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'ON_HOLD', 'COMPLETED', 'CANCELLED']

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'A fazer',
  IN_PROGRESS: 'Em andamento',
  WAITING: 'Aguardando',
  BLOCKED: 'Com impedimento',
  ON_HOLD: 'Pausada',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
}

export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  TODO: 'neutral',
  IN_PROGRESS: 'brand',
  WAITING: 'warning',
  BLOCKED: 'danger',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
}

export const isTaskClosed = (s: TaskStatus) => s === 'COMPLETED' || s === 'CANCELLED'

// ---------------------------------------------------------------- Prioridade

export const PRIORITIES: TaskPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW']

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export const PRIORITY_TONE: Record<TaskPriority, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'brand',
  HIGH: 'warning',
  URGENT: 'danger',
}

// ---------------------------------------------------------------- Pendências e histórico

export const PENDENCY_KIND_LABEL: Record<TaskPendencyKind, string> = {
  IMPEDIMENT: 'Impedimento',
  WAITING: 'Aguardando',
}

export const PENDENCY_KIND_TONE: Record<TaskPendencyKind, Tone> = {
  IMPEDIMENT: 'danger',
  WAITING: 'warning',
}

export const ACTIVITY_KIND_TONE: Record<TaskActivityKind, Tone> = {
  CREATED: 'brand',
  FIELD_UPDATE: 'neutral',
  NOTE: 'brand',
  STARTED: 'brand',
  PENDENCY_OPENED: 'warning',
  PENDENCY_RESOLVED: 'success',
  PUT_ON_HOLD: 'warning',
  RESUMED: 'brand',
  COMPLETED: 'success',
  REOPENED: 'brand',
  CANCELLED: 'neutral',
}

// ---------------------------------------------------------------- Ordenação

export const TASK_SORT_LABEL: Record<TaskSort, string> = {
  RECENT: 'Atividade mais recente',
  IDLE: 'Parada há mais tempo',
  DUE_DATE: 'Prazo mais próximo',
  PRIORITY: 'Mais urgente',
  POSITION: 'Ordem na meta',
  OLDEST_PENDENCY: 'Pendência mais antiga',
}

export const GOAL_SORT_LABEL: Record<GoalSort, string> = {
  RECENT: 'Atividade mais recente',
  IDLE: 'Parada há mais tempo',
  DUE_DATE: 'Prazo mais próximo',
  TITLE: 'Título (A–Z)',
}

// ---------------------------------------------------------------- Prazo e atividade

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

/** Rótulo e tom do prazo; nada quando não há prazo ou está fechada. */
export function dueInfo(x: { deadlineStatus: TaskDeadlineStatus; daysToDue: number | null }): { tone: Tone; label: string } | null {
  const d = x.daysToDue
  switch (x.deadlineStatus) {
    case 'NO_DUE':
    case 'CLOSED':
      return null
    case 'OVERDUE':
      return { tone: 'danger', label: d != null ? `Atrasada ${plural(-d, 'dia', 'dias')}` : 'Atrasada' }
    case 'NEAR':
      return { tone: 'warning', label: d === 0 ? 'Vence hoje' : `Vence em ${plural(d ?? 0, 'dia', 'dias')}` }
    case 'OK':
      return { tone: 'neutral', label: d != null ? `Faltam ${plural(d, 'dia', 'dias')}` : 'No prazo' }
  }
}

export function idleLabel(days: number | null | undefined): string {
  if (days == null) return '—'
  if (days === 0) return 'Atividade hoje'
  return `Sem atividade há ${plural(days, 'dia', 'dias')}`
}

export const daysLabel = (days: number | null | undefined) => (days == null ? '—' : plural(days, 'dia', 'dias'))

// ---------------------------------------------------------------- Alterações no histórico

const FIELD_LABEL: Record<string, string> = {
  title: 'Título',
  description: 'Descrição',
  priority: 'Prioridade',
  startDate: 'Início previsto',
  dueDate: 'Prazo',
  responsibleUser: 'Responsável',
  responsibleName: 'Responsável',
  owner: 'Responsável pela meta',
  position: 'Ordem',
  status: 'Situação',
}

export const taskFieldLabel = (key: string) => FIELD_LABEL[key] ?? key

/** Situação no histórico pode ser de meta ou de tarefa. */
export function statusLabelOf(v: string): string | null {
  if (v in TASK_STATUS_LABEL) return TASK_STATUS_LABEL[v as TaskStatus]
  if (v in GOAL_STATUS_LABEL) return GOAL_STATUS_LABEL[v as TaskGoalStatus]
  return null
}

// ---------------------------------------------------------------- Quem pode fazer o quê

/*
 * Só para a interface (esconder botões): a autorização de verdade é do backend.
 * - gestor da meta: edição na categoria ou dono da meta;
 * - acompanhar tarefa: edição na categoria, ou leitura + responsável pela tarefa,
 *   pela tarefa-mãe ou dono da meta.
 */

export function canManageGoal(access: Access, userId: UUID | undefined, goal: Pick<Goal, 'owner'>): boolean {
  return access.canUpdate || (access.canRead && !!userId && goal.owner?.id === userId)
}

export function canCreateTaskIn(access: Access, userId: UUID | undefined, goal: Pick<Goal, 'owner'>): boolean {
  return access.canCreate || (access.canRead && !!userId && goal.owner?.id === userId)
}

export interface TaskContext {
  goalOwnerId?: UUID | null
  parentResponsibleId?: UUID | null
}

export function canTrackTask(access: Access, userId: UUID | undefined, task: Pick<Task, 'responsibleUser'>, ctx: TaskContext): boolean {
  if (access.canUpdate) return true
  if (!access.canRead || !userId) return false
  return task.responsibleUser?.id === userId || ctx.parentResponsibleId === userId || ctx.goalOwnerId === userId
}

/** Criar subtarefa: criação na categoria, ou responsável pela tarefa-mãe, ou dono da meta. */
export function canCreateSubtask(access: Access, userId: UUID | undefined, parent: Pick<Task, 'responsibleUser'>, ctx: TaskContext): boolean {
  if (access.canCreate) return true
  if (!access.canRead || !userId) return false
  return parent.responsibleUser?.id === userId || ctx.goalOwnerId === userId
}

/** Nome exibido do responsável: texto livre ou, sem ele, o usuário vinculado. */
export const responsibleOf = (t: Pick<Task, 'responsibleName' | 'responsibleUser'>) =>
  t.responsibleName || t.responsibleUser?.name || null

/** Procura a tarefa-mãe de uma subtarefa na árvore da meta. */
export function findTask(tasks: Task[] | undefined, id: UUID | undefined): Task | undefined {
  if (!tasks || !id) return undefined
  for (const t of tasks) {
    if (t.id === id) return t
    const sub = t.subtasks?.find((s) => s.id === id)
    if (sub) return sub
  }
  return undefined
}
