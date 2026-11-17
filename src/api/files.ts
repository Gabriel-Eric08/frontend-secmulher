import { filenameFromDisposition, http, saveBlob } from './http'
import type { ConfidentialityLevel, FileMeta, UUID } from './types'

export const filesApi = {
  get: (id: UUID) => http.get<FileMeta>(`/files/${id}`).then((r) => r.data),
  download: async (id: UUID, fallbackName = 'documento') => {
    const res = await http.get<Blob>(`/files/${id}/download`, { responseType: 'blob' })
    const name = filenameFromDisposition(res.headers['content-disposition'] as string | undefined, fallbackName)
    saveBlob(res.data, name)
  },
  setConfidentiality: (id: UUID, confidentialityLevel: ConfidentialityLevel) =>
    http.patch<FileMeta>(`/files/${id}`, { confidentialityLevel }).then((r) => r.data),
  remove: (id: UUID) => http.delete<void>(`/files/${id}`).then(() => undefined),
}

export function fileDisplayName(f: FileMeta): string {
  return f.originalName || 'Documento'
}
