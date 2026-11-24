import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  amendmentsApi,
  type AmendmentFilters,
  type AmendmentRequest,
  type AmendmentSectorRequest,
  type AmendmentSummaryFilters,
  type CompleteAmendmentRequest,
  type NoteRequest,
  type PendencyRequest,
  type ResolvePendencyRequest,
  type UUID,
} from '@/api'
import { qk } from './keys'

// ---------------------------------------------------------------- Consultas

/** Mantém a lista anterior na tela enquanto um filtro novo carrega. */
export const useAmendments = (filters?: AmendmentFilters, enabled = true) =>
  useQuery({
    queryKey: qk.amendments.list(filters),
    queryFn: () => amendmentsApi.list(filters),
    enabled,
    placeholderData: keepPreviousData,
  })

export const useAmendmentSummary = (filters?: AmendmentSummaryFilters, enabled = true) =>
  useQuery({
    queryKey: qk.amendments.summary(filters),
    queryFn: () => amendmentsApi.summary(filters),
    enabled,
    placeholderData: keepPreviousData,
  })

export const useAmendmentOptions = (enabled = true) =>
  useQuery({ queryKey: qk.amendments.options, queryFn: amendmentsApi.options, enabled, staleTime: 5 * 60 * 1000 })

export const useAmendment = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.amendments.detail(id!), queryFn: () => amendmentsApi.get(id!), enabled: !!id })

export const useAmendmentTimeline = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.amendments.timeline(id!), queryFn: () => amendmentsApi.timeline(id!), enabled: !!id })

export const useAmendmentPendencies = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.amendments.pendencies(id!), queryFn: () => amendmentsApi.pendencies(id!), enabled: !!id })

export const useAmendmentSectors = (enabled = true) =>
  useQuery({ queryKey: qk.amendments.sectors, queryFn: amendmentsApi.sectors.list, enabled })

// ---------------------------------------------------------------- Mutações

function useAmendmentMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.amendments.all }),
  })
}

export const useSaveAmendment = () =>
  useAmendmentMutation(({ id, body }: { id?: UUID; body: AmendmentRequest }) =>
    id ? amendmentsApi.update(id, body) : amendmentsApi.create(body),
  )

export const useDeleteAmendment = () => useAmendmentMutation(amendmentsApi.remove)

export const useAddAmendmentNote = () =>
  useAmendmentMutation(({ id, body }: { id: UUID; body: NoteRequest }) => amendmentsApi.addNote(id, body))

export const useOpenPendency = () =>
  useAmendmentMutation(({ id, body }: { id: UUID; body: PendencyRequest }) => amendmentsApi.openPendency(id, body))

export const useResolvePendency = () =>
  useAmendmentMutation(({ id, pendencyId, body }: { id: UUID; pendencyId: UUID; body: ResolvePendencyRequest }) =>
    amendmentsApi.resolvePendency(id, pendencyId, body),
  )

export const useCompleteAmendment = () =>
  useAmendmentMutation(({ id, body }: { id: UUID; body: CompleteAmendmentRequest }) => amendmentsApi.complete(id, body))

export const useCancelAmendment = () =>
  useAmendmentMutation(({ id, reason }: { id: UUID; reason: string }) => amendmentsApi.cancel(id, reason))

export const useReopenAmendment = () =>
  useAmendmentMutation(({ id, reason }: { id: UUID; reason: string }) => amendmentsApi.reopen(id, reason))

export const useSaveAmendmentSector = () =>
  useAmendmentMutation(({ id, body }: { id?: UUID; body: AmendmentSectorRequest }) =>
    id ? amendmentsApi.sectors.update(id, body) : amendmentsApi.sectors.create(body),
  )

export const useDeleteAmendmentSector = () => useAmendmentMutation(amendmentsApi.sectors.remove)
