import { http } from './http'
import type { Category, CategoryField, CategoryFieldRequest, CategoryRequest, UUID } from './types'

export const categoriesApi = {
  list: () => http.get<Category[]>('/categories').then((r) => r.data),
  get: (id: UUID) => http.get<Category>(`/categories/${id}`).then((r) => r.data),
  create: (body: CategoryRequest) => http.post<Category>('/categories', body).then((r) => r.data),
  update: (id: UUID, body: CategoryRequest) => http.put<Category>(`/categories/${id}`, body).then((r) => r.data),
  remove: (id: UUID) => http.delete<void>(`/categories/${id}`).then(() => undefined),
}

export const fieldsApi = {
  list: (categoryId: UUID) =>
    http.get<CategoryField[]>(`/categories/${categoryId}/fields`).then((r) => r.data),
  create: (categoryId: UUID, body: CategoryFieldRequest) =>
    http.post<CategoryField>(`/categories/${categoryId}/fields`, body).then((r) => r.data),
  update: (categoryId: UUID, fieldId: UUID, body: CategoryFieldRequest) =>
    http.put<CategoryField>(`/categories/${categoryId}/fields/${fieldId}`, body).then((r) => r.data),
  remove: (categoryId: UUID, fieldId: UUID, purgeData = false) =>
    http
      .delete<void>(`/categories/${categoryId}/fields/${fieldId}`, { params: { purgeData } })
      .then(() => undefined),
}
