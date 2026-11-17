import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  entitiesApi,
  filesApi,
  mulheresApi,
  recordsApi,
  type ActivityRequest,
  type ConfidentialityLevel,
  type DynamicEntityRequest,
  type MulherRequest,
  type RecordKind,
  type SearchRequest,
  type UUID,
} from '@/api'
import { qk } from './keys'

// ---------------------------------------------------------------- Mulheres

export const useMulheres = (enabled = true) =>
  useQuery({ queryKey: qk.mulheres.all, queryFn: mulheresApi.list, enabled })

export const useMulher = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.mulheres.detail(id!), queryFn: () => mulheresApi.get(id!), enabled: !!id })

export function useSaveMulher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: UUID; body: MulherRequest }) =>
      id ? mulheresApi.update(id, body) : mulheresApi.create(body),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: qk.mulheres.all })
      qc.invalidateQueries({ queryKey: qk.record.root('clients', m.id) })
    },
  })
}

export function useDeleteMulher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: mulheresApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.mulheres.all }),
  })
}

// ---------------------------------------------------------------- Entidades dinâmicas

export const useEntities = (categoryId?: UUID) =>
  useQuery({ queryKey: qk.entities.byCategory(categoryId), queryFn: () => entitiesApi.list(categoryId) })

export const useEntitySearch = (req: SearchRequest | null) =>
  useQuery({
    queryKey: qk.entities.search(req!),
    queryFn: () => entitiesApi.search(req!),
    enabled: !!req,
    placeholderData: keepPreviousData,
  })

export const useEntity = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.entities.detail(id!), queryFn: () => entitiesApi.get(id!), enabled: !!id })

export function useSaveEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: UUID; body: DynamicEntityRequest }) =>
      id ? entitiesApi.update(id, body) : entitiesApi.create(body),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: qk.entities.all })
      qc.invalidateQueries({ queryKey: qk.record.root('dynamic-entities', e.id) })
    },
  })
}

export function useDeleteEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: entitiesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.entities.all }),
  })
}

// ---------------------------------------------------------------- Visão 360°, linha do tempo e documentos

export const useOverview = <T>(kind: RecordKind, id: UUID | undefined) =>
  useQuery({
    queryKey: qk.record.overview(kind, id!),
    queryFn: () => recordsApi.overview<T>(kind, id!),
    enabled: !!id,
  })

export const useRecordActivities = (kind: RecordKind, id: UUID | undefined) =>
  useQuery({
    queryKey: qk.record.activities(kind, id!),
    queryFn: () => recordsApi.activities(kind, id!),
    enabled: !!id,
  })

export const useRecordFiles = (kind: RecordKind, id: UUID | undefined) =>
  useQuery({ queryKey: qk.record.files(kind, id!), queryFn: () => recordsApi.files(kind, id!), enabled: !!id })

export function useAddActivity(kind: RecordKind, id: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ActivityRequest) => recordsApi.addActivity(kind, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.record.root(kind, id) }),
  })
}

export function useUploadFile(kind: RecordKind, id: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, level }: { file: File; level: ConfidentialityLevel }) =>
      recordsApi.upload(kind, id, file, level),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.record.root(kind, id) }),
  })
}

/** Mutations sobre /files/{id}; invalidam o registro dono do arquivo. */
export function useFileActions(kind: RecordKind, recordId: UUID) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.record.root(kind, recordId) })

  const setConfidentiality = useMutation({
    mutationFn: ({ fileId, level }: { fileId: UUID; level: ConfidentialityLevel }) =>
      filesApi.setConfidentiality(fileId, level),
    onSuccess: invalidate,
  })
  const remove = useMutation({ mutationFn: filesApi.remove, onSuccess: invalidate })
  const download = useMutation({
    mutationFn: ({ fileId, name }: { fileId: UUID; name: string }) => filesApi.download(fileId, name),
    // downloads restritos geram FILE_DOWNLOADED na linha do tempo
    onSuccess: invalidate,
  })
  return { setConfidentiality, remove, download }
}
