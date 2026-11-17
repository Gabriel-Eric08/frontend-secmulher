import { http } from './http'
import type { Permission, PermissionRequest, UUID } from './types'

export const permissionsApi = {
  list: (userId?: UUID) =>
    http.get<Permission[]>('/permissions', { params: userId ? { userId } : undefined }).then((r) => r.data),
  get: (id: UUID) => http.get<Permission>(`/permissions/${id}`).then((r) => r.data),
  create: (body: PermissionRequest) => http.post<Permission>('/permissions', body).then((r) => r.data),
  update: (id: UUID, body: PermissionRequest) =>
    http.put<Permission>(`/permissions/${id}`, body).then((r) => r.data),
  remove: (id: UUID) => http.delete<void>(`/permissions/${id}`).then(() => undefined),
}
