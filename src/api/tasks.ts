import { http } from './http'
import type { ISODate, UUID } from './types'
import type { LocalDateTime } from './fleet'

/**
 * Módulo de tarefas: trilha de metas. Cada meta reúne tarefas, e cada tarefa pode ter
 * subtarefas (um nível só). Datas "AAAA-MM-DD"; datas e horas "AAAA-MM-DDTHH:MM[:SS]".
 */

export type TaskGoalStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'WAITING' | 'BLOCKED' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TaskPendencyKind = 'IMPEDIMENT' | 'WAITING'
export type TaskActivityKind =
  | 'CREATED'
  | 'FIELD_UPDATE'
  | 'NOTE'
  | 'STARTED'
  | 'PENDENCY_OPENED'
  | 'PENDENCY_RESOLVED'
  | 'PUT_ON_HOLD'
  | 'RESUMED'
  | 'COMPLETED'
  | 'REOPENED'
  | 'CANCELLED'
export type TaskDeadlineStatus = 'NO_DUE' | 'OK' | 'NEAR' | 'OVERDUE' | 'CLOSED'
export type TaskLevel = 'ALL' | 'ROOT' | 'SUBTASK'
export type TaskSort = 'RECENT' | 'IDLE' | 'DUE_DATE' | 'PRIORITY' | 'POSITION' | 'OLDEST_PENDENCY'
export type GoalSort = 'RECENT' | 'IDLE' | 'DUE_DATE' | 'TITLE'

export interface TaskUserRef {
  id: UUID
  name: string
}

export interface GoalRef {
  id: UUID
  title: string
  status: TaskGoalStatus
}

export interface TaskRef {
  id: UUID
  title: string
  status: TaskStatus
}

export interface TasksAccess {
  canRead: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

/** Andamento: tarefas da meta ou subtarefas da tarefa. percent nulo = nada a contar. */
export interface TaskProgress {
  total: number
  completed: number
  cancelled: number
  percent: number | null
}

// ---------------------------------------------------------------- Metas

export interface Goal {
  id: UUID
  title: string
  description: string | null
  owner: TaskUserRef | null
  startDate: ISODate | null
  dueDate: ISODate | null
  status: TaskGoalStatus
  statusLabel: string
  holdReason: string | null
  onHoldSince: LocalDateTime | null
  lastActivityAt: LocalDateTime
  idleDays: number | null
  idle: boolean
  /** Negativo = atrasada */
  daysToDue: number | null
  deadlineStatus: TaskDeadlineStatus
  progress: TaskProgress
  completedAt: LocalDateTime | null
  completedBy: TaskUserRef | null
  cancelledAt: LocalDateTime | null
  cancelledBy: TaskUserRef | null
  createdBy: UUID | null
  createdAt: LocalDateTime
  updatedAt: LocalDateTime
}

export interface GoalDetail {
  goal: Goal
  /** Na ordem definida, cada uma com `subtasks` */
  tasks: Task[]
}

/** No PUT o corpo substitui tudo (campo ausente = vazio). */
export interface GoalRequest {
  title: string
  description?: string
  ownerUserId?: UUID | null
  startDate?: ISODate | null
  dueDate?: ISODate | null
  comment?: string
}

export interface GoalFilters {
  status?: TaskGoalStatus[]
  open?: boolean
  ownerUserId?: UUID
  mine?: boolean
  idleDays?: number
  dueWithinDays?: number
  overdue?: boolean
  q?: string
  sort?: GoalSort
}

// ---------------------------------------------------------------- Tarefas

export interface Task {
  id: UUID
  goal: GoalRef
  /** Nulo em tarefa; preenchido em subtarefa */
  parent: TaskRef | null
  subtask: boolean
  title: string
  description: string | null
  priority: TaskPriority
  priorityLabel: string
  startDate: ISODate | null
  dueDate: ISODate | null
  status: TaskStatus
  statusLabel: string
  /** Usuário do sistema vinculado: dá as permissões de responsável e entra em `mine` */
  responsibleUser: TaskUserRef | null
  /** Responsável em texto livre (nome exibido); pode não ser usuário do sistema */
  responsibleName: string | null
  position: number
  startedAt: LocalDateTime | null
  holdReason: string | null
  onHoldSince: LocalDateTime | null
  lastActivityAt: LocalDateTime
  idleDays: number | null
  idle: boolean
  daysToDue: number | null
  deadlineStatus: TaskDeadlineStatus
  openPendencies: number
  oldestOpenPendencyAt: LocalDateTime | null
  /** Das subtarefas; nulo em subtarefa */
  progress: TaskProgress | null
  completedAt: LocalDateTime | null
  completedBy: TaskUserRef | null
  cancelledAt: LocalDateTime | null
  cancelledBy: TaskUserRef | null
  createdBy: UUID | null
  createdAt: LocalDateTime
  updatedAt: LocalDateTime
  /** Só no detalhe (GET /tasks/{id} e GET /tasks/goals/{id}) */
  subtasks: Task[] | null
}

/**
 * POST: `goalId` obrigatório para tarefa; `parentId` cria subtarefa.
 * PUT: goalId/parentId ignorados; priority e position ausentes mantêm os atuais; o resto substitui.
 */
export interface TaskRequest {
  goalId?: UUID
  parentId?: UUID
  title: string
  description?: string
  priority?: TaskPriority
  startDate?: ISODate | null
  dueDate?: ISODate | null
  responsibleUserId?: UUID | null
  /** Texto livre; sem ele, o backend guarda o nome do usuário vinculado */
  responsibleName?: string | null
  position?: number
  comment?: string
}

export interface TaskFilters {
  goalId?: UUID
  parentId?: UUID
  level?: TaskLevel
  status?: TaskStatus[]
  priority?: TaskPriority[]
  open?: boolean
  pending?: boolean
  pendencyKind?: TaskPendencyKind
  responsibleUserId?: UUID
  /** Igual, sem diferenciar maiúsculas */
  responsibleName?: string
  mine?: boolean
  idleDays?: number
  dueWithinDays?: number
  overdue?: boolean
  q?: string
  sort?: TaskSort
}

export interface TaskSummaryFilters {
  goalId?: UUID
  responsibleUserId?: UUID
  responsibleName?: string
  mine?: boolean
}

export interface TaskSummary {
  total: number
  byStatus: Partial<Record<TaskStatus, number>>
  open: number
  pending: number
  overdue: number
  nearDue: number
  deadlineAlertDays: number
  idle: number
  idleDays: number
}

export interface TaskOptions {
  goals: GoalRef[]
  responsibleUsers: TaskUserRef[]
  /** Nomes de responsável já usados (sugestões ao atribuir) */
  responsibleNames: string[]
  goalOwners: TaskUserRef[]
}

// ---------------------------------------------------------------- Acompanhamento

export interface TaskPendency {
  id: UUID
  taskId: UUID
  kind: TaskPendencyKind
  kindLabel: string
  description: string
  waitingOn: string | null
  open: boolean
  openedAt: LocalDateTime
  openedBy: TaskUserRef | null
  resolvedAt: LocalDateTime | null
  resolvedBy: TaskUserRef | null
  resolution: string | null
  daysOpen: number | null
}

export interface TaskActivity {
  id: UUID
  goalId: UUID
  /** Nulo = evento da própria meta */
  task: TaskRef | null
  subtask: boolean
  kind: TaskActivityKind
  kindLabel: string
  description: string | null
  changes: Record<string, unknown> | null
  pendencyId: UUID | null
  user: TaskUserRef | null
  occurredAt: LocalDateTime
  createdAt: LocalDateTime
}

export interface TaskNoteRequest {
  description: string
  occurredAt?: LocalDateTime
}

export interface TaskStartRequest {
  description?: string
  startedAt?: LocalDateTime
}

export interface TaskPendencyRequest {
  kind: TaskPendencyKind
  description: string
  waitingOn?: string
  openedAt?: LocalDateTime
}

export interface TaskResolvePendencyRequest {
  resolution: string
  resolvedAt?: LocalDateTime
}

export interface TaskCompleteRequest {
  description?: string
  completedAt?: LocalDateTime
}

function clean<T extends object>(params: T | undefined): Partial<T> | undefined {
  if (!params) return undefined
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0),
    ),
  ) as Partial<T>
}

/** status=TODO&status=BLOCKED (sem colchetes), como o Spring espera */
const repeatArrays = { indexes: null }

const data = <T,>(r: { data: T }) => r.data

export const tasksApi = {
  access: () => http.get<TasksAccess>('/tasks/access').then(data),

  goals: {
    list: (filters?: GoalFilters) =>
      http.get<Goal[]>('/tasks/goals', { params: clean(filters), paramsSerializer: repeatArrays }).then(data),
    get: (id: UUID) => http.get<GoalDetail>(`/tasks/goals/${id}`).then(data),
    timeline: (id: UUID) => http.get<TaskActivity[]>(`/tasks/goals/${id}/timeline`).then(data),
    create: (body: GoalRequest) => http.post<Goal>('/tasks/goals', body).then(data),
    update: (id: UUID, body: GoalRequest) => http.put<Goal>(`/tasks/goals/${id}`, body).then(data),
    remove: (id: UUID) => http.delete<void>(`/tasks/goals/${id}`).then(() => undefined),
    addNote: (id: UUID, body: TaskNoteRequest) => http.post<Goal>(`/tasks/goals/${id}/notes`, body).then(data),
    hold: (id: UUID, reason: string) => http.post<Goal>(`/tasks/goals/${id}/hold`, { reason }).then(data),
    resume: (id: UUID, description?: string) =>
      http.post<Goal>(`/tasks/goals/${id}/resume`, { description }).then(data),
    complete: (id: UUID, body: TaskCompleteRequest) =>
      http.post<Goal>(`/tasks/goals/${id}/complete`, body).then(data),
    cancel: (id: UUID, reason: string) => http.post<Goal>(`/tasks/goals/${id}/cancel`, { reason }).then(data),
    reopen: (id: UUID, reason: string) => http.post<Goal>(`/tasks/goals/${id}/reopen`, { reason }).then(data),
  },

  list: (filters?: TaskFilters) =>
    http.get<Task[]>('/tasks', { params: clean(filters), paramsSerializer: repeatArrays }).then(data),
  summary: (filters?: TaskSummaryFilters) =>
    http.get<TaskSummary>('/tasks/summary', { params: clean(filters) }).then(data),
  options: (goalId?: UUID) => http.get<TaskOptions>('/tasks/options', { params: clean({ goalId }) }).then(data),
  get: (id: UUID) => http.get<Task>(`/tasks/${id}`).then(data),
  timeline: (id: UUID) => http.get<TaskActivity[]>(`/tasks/${id}/timeline`).then(data),
  pendencies: (id: UUID, open?: boolean) =>
    http.get<TaskPendency[]>(`/tasks/${id}/pendencies`, { params: clean({ open }) }).then(data),
  create: (body: TaskRequest) => http.post<Task>('/tasks', body).then(data),
  update: (id: UUID, body: TaskRequest) => http.put<Task>(`/tasks/${id}`, body).then(data),
  remove: (id: UUID) => http.delete<void>(`/tasks/${id}`).then(() => undefined),
  addNote: (id: UUID, body: TaskNoteRequest) => http.post<Task>(`/tasks/${id}/notes`, body).then(data),
  start: (id: UUID, body: TaskStartRequest) => http.post<Task>(`/tasks/${id}/start`, body).then(data),
  openPendency: (id: UUID, body: TaskPendencyRequest) =>
    http.post<TaskPendency>(`/tasks/${id}/pendencies`, body).then(data),
  resolvePendency: (id: UUID, pendencyId: UUID, body: TaskResolvePendencyRequest) =>
    http.post<TaskPendency>(`/tasks/${id}/pendencies/${pendencyId}/resolve`, body).then(data),
  hold: (id: UUID, reason: string) => http.post<Task>(`/tasks/${id}/hold`, { reason }).then(data),
  resume: (id: UUID, description?: string) => http.post<Task>(`/tasks/${id}/resume`, { description }).then(data),
  complete: (id: UUID, body: TaskCompleteRequest) => http.post<Task>(`/tasks/${id}/complete`, body).then(data),
  cancel: (id: UUID, reason: string) => http.post<Task>(`/tasks/${id}/cancel`, { reason }).then(data),
  reopen: (id: UUID, reason: string) => http.post<Task>(`/tasks/${id}/reopen`, { reason }).then(data),
}
