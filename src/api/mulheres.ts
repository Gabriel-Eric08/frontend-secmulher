import { http } from './http'
import type { Mulher, MulherRequest, UUID } from './types'

/** Consumidor de /clients: no domínio da Secretaria, "clientes" são as mulheres atendidas. */
export const mulheresApi = {
  list: () => http.get<Mulher[]>('/clients').then((r) => r.data),
  get: (id: UUID) => http.get<Mulher>(`/clients/${id}`).then((r) => r.data),
  create: (body: MulherRequest) => http.post<Mulher>('/clients', body).then((r) => r.data),
  update: (id: UUID, body: MulherRequest) => http.put<Mulher>(`/clients/${id}`, body).then((r) => r.data),
  remove: (id: UUID) => http.delete<void>(`/clients/${id}`).then(() => undefined),
}
