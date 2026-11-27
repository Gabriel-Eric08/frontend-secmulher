import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  tasksApi,
  type Task,
  type GoalFilters,
  type GoalRequest,
  type TaskCompleteRequest,
  type TaskFilters,
  type TaskNoteRequest,
  type TaskPendencyRequest,
  type TaskRequest,
  type TaskResolvePendencyRequest,
  type TaskStartRequest,
  type TaskStatsFilters,
  type TaskSummaryFilters,
  type UUID,
} from '@/api'
import { qk } from './keys'

// ---------------------------------------------------------------- Consultas

export const useGoals = (filters?: GoalFilters, enabled = true) =>
  useQuery({
    queryKey: qk.tasks.goals(filters),
    queryFn: () => tasksApi.goals.list(filters),
    enabled,
    placeholderData: keepPreviousData,
  })

export const useGoal = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.tasks.goal(id!), queryFn: () => tasksApi.goals.get(id!), enabled: !!id })

export const useGoalTimeline = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.tasks.goalTimeline(id!), queryFn: () => tasksApi.goals.timeline(id!), enabled: !!id })

/** Mantém a lista anterior na tela enquanto um filtro novo carrega. */
export const useTasks = (filters?: TaskFilters, enabled = true) =>
  useQuery({
    queryKey: qk.tasks.list(filters),
    queryFn: () => tasksApi.list(filters),
    enabled,
    placeholderData: keepPreviousData,
  })

export const useTaskSummary = (filters?: TaskSummaryFilters, enabled = true) =>
  useQuery({
    queryKey: qk.tasks.summary(filters),
    queryFn: () => tasksApi.summary(filters),
    enabled,
    placeholderData: keepPreviousData,
  })

/** Dados dos gráficos; mantém o gráfico anterior (esmaecido) enquanto um filtro novo carrega. */
export const useTaskStats = (filters?: TaskStatsFilters, enabled = true) =>
  useQuery({
    queryKey: qk.tasks.stats(filters),
    queryFn: () => tasksApi.stats(filters),
    enabled,
    placeholderData: keepPreviousData,
  })

export const useTaskOptions = (goalId?: UUID, enabled = true) =>
  useQuery({
    queryKey: qk.tasks.options(goalId),
    queryFn: () => tasksApi.options(goalId),
    enabled,
    staleTime: 60 * 1000,
  })

export const useTask = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.tasks.detail(id!), queryFn: () => tasksApi.get(id!), enabled: !!id })

export const useTaskTimeline = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.tasks.timeline(id!), queryFn: () => tasksApi.timeline(id!), enabled: !!id })

export const useTaskPendencies = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.tasks.pendencies(id!), queryFn: () => tasksApi.pendencies(id!), enabled: !!id })

// ---------------------------------------------------------------- Mutações

/** Qualquer ação muda situação, prazos, progresso da meta e histórico: invalida o módulo inteiro. */
function useTasksMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks.all }),
  })
}

// Metas

export const useSaveGoal = () =>
  useTasksMutation(({ id, body }: { id?: UUID; body: GoalRequest }) =>
    id ? tasksApi.goals.update(id, body) : tasksApi.goals.create(body),
  )

export const useDeleteGoal = () => useTasksMutation(tasksApi.goals.remove)

export const useAddGoalNote = () =>
  useTasksMutation(({ id, body }: { id: UUID; body: TaskNoteRequest }) => tasksApi.goals.addNote(id, body))

export const useHoldGoal = () =>
  useTasksMutation(({ id, reason }: { id: UUID; reason: string }) => tasksApi.goals.hold(id, reason))

export const useResumeGoal = () =>
  useTasksMutation(({ id, description }: { id: UUID; description?: string }) => tasksApi.goals.resume(id, description))

export const useCompleteGoal = () =>
  useTasksMutation(({ id, body }: { id: UUID; body: TaskCompleteRequest }) => tasksApi.goals.complete(id, body))

export const useCancelGoal = () =>
  useTasksMutation(({ id, reason }: { id: UUID; reason: string }) => tasksApi.goals.cancel(id, reason))

export const useReopenGoal = () =>
  useTasksMutation(({ id, reason }: { id: UUID; reason: string }) => tasksApi.goals.reopen(id, reason))

// Tarefas

export const useSaveTask = () =>
  useTasksMutation(({ id, body }: { id?: UUID; body: TaskRequest }) =>
    id ? tasksApi.update(id, body) : tasksApi.create(body),
  )

export const useDeleteTask = () => useTasksMutation(tasksApi.remove)

export const useAddTaskNote = () =>
  useTasksMutation(({ id, body }: { id: UUID; body: TaskNoteRequest }) => tasksApi.addNote(id, body))

export const useStartTask = () =>
  useTasksMutation(({ id, body }: { id: UUID; body: TaskStartRequest }) => tasksApi.start(id, body))

export const useOpenTaskPendency = () =>
  useTasksMutation(({ id, body }: { id: UUID; body: TaskPendencyRequest }) => tasksApi.openPendency(id, body))

export const useResolveTaskPendency = () =>
  useTasksMutation(({ id, pendencyId, body }: { id: UUID; pendencyId: UUID; body: TaskResolvePendencyRequest }) =>
    tasksApi.resolvePendency(id, pendencyId, body),
  )

export const useHoldTask = () =>
  useTasksMutation(({ id, reason }: { id: UUID; reason: string }) => tasksApi.hold(id, reason))

export const useResumeTask = () =>
  useTasksMutation(({ id, description }: { id: UUID; description?: string }) => tasksApi.resume(id, description))

export const useCompleteTask = () =>
  useTasksMutation(({ id, body }: { id: UUID; body: TaskCompleteRequest }) => tasksApi.complete(id, body))

export const useCancelTask = () =>
  useTasksMutation(({ id, reason }: { id: UUID; reason: string }) => tasksApi.cancel(id, reason))

export const useReopenTask = () =>
  useTasksMutation(({ id, reason }: { id: UUID; reason: string }) => tasksApi.reopen(id, reason))

// Ordem

/** PUT substitui os campos: reenvia os atuais mudando só a posição. */
function bodyWithPosition(t: Task, position: number): TaskRequest {
  return {
    title: t.title,
    description: t.description ?? undefined,
    priority: t.priority,
    startDate: t.startDate,
    dueDate: t.dueDate,
    responsibleUserId: t.responsibleUser?.id ?? null,
    responsibleName: t.responsibleName,
    position,
  }
}

/**
 * Troca a posição de duas tarefas irmãs (ou subtarefas da mesma mãe). Se a segunda
 * alteração falhar, devolve a primeira à posição original.
 */
export const useSwapTasks = () =>
  useTasksMutation(async ({ moving, other, direction }: { moving: Task; other: Task; direction: 'up' | 'down' }) => {
    if (moving.position === other.position) {
      // posições empatadas (desempate pela data de cadastro): afasta só uma delas
      if (direction === 'down') await tasksApi.update(moving.id, bodyWithPosition(moving, other.position + 1))
      else await tasksApi.update(other.id, bodyWithPosition(other, moving.position + 1))
      return
    }
    await tasksApi.update(moving.id, bodyWithPosition(moving, other.position))
    try {
      await tasksApi.update(other.id, bodyWithPosition(other, moving.position))
    } catch (err) {
      await tasksApi.update(moving.id, bodyWithPosition(moving, moving.position)).catch(() => undefined)
      throw err
    }
  })
