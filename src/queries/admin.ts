import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  categoriesApi,
  fieldsApi,
  permissionsApi,
  usersApi,
  type CategoryFieldRequest,
  type CategoryRequest,
  type PermissionRequest,
  type UserRequest,
  type UUID,
} from '@/api'
import { qk } from './keys'

// ---------------------------------------------------------------- Usuários (funcionárias)

export const useUsers = (enabled = true) => useQuery({ queryKey: qk.users.all, queryFn: usersApi.list, enabled })

export const useUser = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.users.detail(id!), queryFn: () => usersApi.get(id!), enabled: !!id })

export const useUserActivities = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.users.activities(id!), queryFn: () => usersApi.activities(id!), enabled: !!id })

export function useSaveUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: UUID; body: UserRequest }) =>
      id ? usersApi.update(id, body) : usersApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.users.all })
      qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users.all }),
  })
}

// ---------------------------------------------------------------- Categorias

export const useCategories = () => useQuery({ queryKey: qk.categories.all, queryFn: categoriesApi.list })

export const useCategory = (id: UUID | undefined) =>
  useQuery({ queryKey: qk.categories.detail(id!), queryFn: () => categoriesApi.get(id!), enabled: !!id })

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: UUID; body: CategoryRequest }) =>
      id ? categoriesApi.update(id, body) : categoriesApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories.all })
      qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: categoriesApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories.all })
      qc.invalidateQueries({ queryKey: qk.me })
    },
  })
}

// ---------------------------------------------------------------- Campos

export const useFields = (categoryId: UUID | undefined, enabled = true) =>
  useQuery({
    queryKey: qk.categories.fields(categoryId!),
    queryFn: async () => (await fieldsApi.list(categoryId!)).sort((a, b) => a.position - b.position),
    enabled: !!categoryId && enabled,
  })

export function useSaveField(categoryId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: UUID; body: CategoryFieldRequest }) =>
      id ? fieldsApi.update(categoryId, id, body) : fieldsApi.create(categoryId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.categories.fields(categoryId) }),
  })
}

export function useDeleteField(categoryId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, purgeData }: { id: UUID; purgeData?: boolean }) =>
      fieldsApi.remove(categoryId, id, purgeData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.categories.fields(categoryId) })
      qc.invalidateQueries({ queryKey: qk.entities.all })
    },
  })
}

// ---------------------------------------------------------------- Permissões

export const usePermissions = (userId?: UUID) =>
  useQuery({ queryKey: qk.permissions.byUser(userId), queryFn: () => permissionsApi.list(userId) })

export function useSavePermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: UUID; body: PermissionRequest }) =>
      id ? permissionsApi.update(id, body) : permissionsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.permissions.all }),
  })
}

export function useDeletePermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: permissionsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.permissions.all }),
  })
}
