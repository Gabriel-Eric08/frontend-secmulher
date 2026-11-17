import { http } from './http'
import type { DynamicEntity, DynamicEntityRequest, SearchRequest, UUID } from './types'

export const entitiesApi = {
  list: (categoryId?: UUID) =>
    http
      .get<DynamicEntity[]>('/dynamic-entities', { params: categoryId ? { categoryId } : undefined })
      .then((r) => r.data),
  get: (id: UUID) => http.get<DynamicEntity>(`/dynamic-entities/${id}`).then((r) => r.data),
  search: (body: SearchRequest) =>
    http.post<DynamicEntity[]>('/dynamic-entities/search', body).then((r) => r.data),
  create: (body: DynamicEntityRequest) =>
    http.post<DynamicEntity>('/dynamic-entities', body).then((r) => r.data),
  update: (id: UUID, body: DynamicEntityRequest) =>
    http.put<DynamicEntity>(`/dynamic-entities/${id}`, body).then((r) => r.data),
  remove: (id: UUID) => http.delete<void>(`/dynamic-entities/${id}`).then(() => undefined),
}
