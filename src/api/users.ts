import { http } from './http'
import type { Activity, User, UserRequest, UUID } from './types'

export const usersApi = {
  list: () => http.get<User[]>('/users').then((r) => r.data),
  get: (id: UUID) => http.get<User>(`/users/${id}`).then((r) => r.data),
  activities: (id: UUID) => http.get<Activity[]>(`/users/${id}/activities`).then((r) => r.data),
  create: (body: UserRequest) => http.post<User>('/users', body).then((r) => r.data),
  update: (id: UUID, body: UserRequest) => http.put<User>(`/users/${id}`, body).then((r) => r.data),
  remove: (id: UUID) => http.delete<void>(`/users/${id}`).then(() => undefined),
}
