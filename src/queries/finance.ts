import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  financeApi,
  type CommitmentCreateRequest,
  type CommitmentFilters,
  type CommitmentMovement,
  type CommitmentMovementRequest,
  type CommitmentUpdateRequest,
  type DistributionRequest,
  type FinanceActionCreateRequest,
  type FinanceActionUpdateRequest,
  type FinanceSubActionRequest,
  type OperationFilters,
  type PeriodFilter,
  type TacRequest,
  type TransferRequest,
  type UUID,
} from '@/api'
import { qk } from './keys'

// ---------------------------------------------------------------- Consultas

export const useFinanceDashboard = (date?: string, enabled = true) =>
  useQuery({ queryKey: qk.finance.dashboard(date), queryFn: () => financeApi.dashboard(date), enabled })

export const useFinanceAction = (id: UUID | undefined, date?: string) =>
  useQuery({ queryKey: qk.finance.action(id!, date), queryFn: () => financeApi.actions.get(id!, date), enabled: !!id })

export const useFinanceActionHistory = (id: UUID | undefined, period?: PeriodFilter, enabled = true) =>
  useQuery({
    queryKey: qk.finance.actionHistory(id!, period),
    queryFn: () => financeApi.actions.history(id!, period),
    enabled: !!id && enabled,
  })

export const useFinanceSubAction = (id: UUID | undefined, date?: string) =>
  useQuery({
    queryKey: qk.finance.subAction(id!, date),
    queryFn: () => financeApi.subActions.get(id!, date),
    enabled: !!id,
  })

export const useFinanceSubActionHistory = (id: UUID | undefined, period?: PeriodFilter, enabled = true) =>
  useQuery({
    queryKey: qk.finance.subActionHistory(id!, period),
    queryFn: () => financeApi.subActions.history(id!, period),
    enabled: !!id && enabled,
  })

export const useFinanceOperations = (filters?: OperationFilters, enabled = true) =>
  useQuery({ queryKey: qk.finance.operations(filters), queryFn: () => financeApi.operations.list(filters), enabled })

export const useCommitments = (filters?: CommitmentFilters, enabled = true) =>
  useQuery({ queryKey: qk.finance.commitments(filters), queryFn: () => financeApi.commitments.list(filters), enabled })

export const useCommitment = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.finance.commitment(id!), queryFn: () => financeApi.commitments.get(id!), enabled: !!id })

// ---------------------------------------------------------------- Mutações
// Qualquer movimentação altera saldos em várias telas (painel, ação, subação, históricos):
// invalidar tudo sob ['finance'] é o caminho simples e correto.

function useFinanceMutation<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.finance.all }),
  })
}

export const useSaveFinanceAction = () =>
  useFinanceMutation(
    (v: { id: UUID; body: FinanceActionUpdateRequest } | { id?: undefined; body: FinanceActionCreateRequest }) =>
      v.id ? financeApi.actions.update(v.id, v.body) : financeApi.actions.create(v.body),
  )

export const useDeleteFinanceAction = () => useFinanceMutation(financeApi.actions.remove)

export const useSaveSubAction = () =>
  useFinanceMutation((v: { id?: UUID; actionId: UUID; body: FinanceSubActionRequest }) =>
    v.id ? financeApi.subActions.update(v.id, v.body) : financeApi.actions.createSubAction(v.actionId, v.body),
  )

export const useDeleteSubAction = () => useFinanceMutation(financeApi.subActions.remove)

export const useDistribute = () => useFinanceMutation((body: DistributionRequest) => financeApi.operations.distribute(body))

export const useTransfer = () =>
  useFinanceMutation(({ crossAction, body }: { crossAction: boolean; body: TransferRequest }) =>
    crossAction ? financeApi.operations.transferBetweenActions(body) : financeApi.operations.transferBetweenSubActions(body),
  )

export const useTac = () => useFinanceMutation((body: TacRequest) => financeApi.operations.tac(body))

export const useCreateCommitment = () =>
  useFinanceMutation((body: CommitmentCreateRequest) => financeApi.commitments.create(body))

export const useUpdateCommitment = () =>
  useFinanceMutation(({ id, body }: { id: UUID; body: CommitmentUpdateRequest }) => financeApi.commitments.update(id, body))

export const useCommitmentMovement = () =>
  useFinanceMutation(
    ({ id, movement, body }: { id: UUID; movement: CommitmentMovement; body: CommitmentMovementRequest }) =>
      financeApi.commitments.move(id, movement, body),
  )
