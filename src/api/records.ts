import { http } from './http'
import type {
  Activity,
  ActivityRequest,
  ConfidentialityLevel,
  FileMeta,
  Overview,
  RecordKind,
  UUID,
} from './types'

/**
 * Rotas compartilhadas por mulheres (/clients) e entidades dinâmicas (/dynamic-entities):
 * visão 360°, linha do tempo e documentos.
 */
export const recordsApi = {
  overview: <T>(kind: RecordKind, id: UUID) =>
    http.get<Overview<T>>(`/${kind}/${id}/overview`).then((r) => r.data),
  activities: (kind: RecordKind, id: UUID) =>
    http.get<Activity[]>(`/${kind}/${id}/activities`).then((r) => r.data),
  addActivity: (kind: RecordKind, id: UUID, body: ActivityRequest) =>
    http.post<Activity>(`/${kind}/${id}/activities`, body).then((r) => r.data),
  files: (kind: RecordKind, id: UUID) => http.get<FileMeta[]>(`/${kind}/${id}/files`).then((r) => r.data),
  upload: (kind: RecordKind, id: UUID, file: File, confidentialityLevel: ConfidentialityLevel) => {
    const form = new FormData()
    form.append('file', file)
    form.append('confidentialityLevel', confidentialityLevel)
    return http
      .post<FileMeta>(`/${kind}/${id}/files`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },
}
