import axios from 'axios'
import { env } from '@/config/env'
import { tokenStorage } from './tokenStorage'
import { toApiError } from './errors'

export const http = axios.create({
  baseURL: env.apiUrl,
  headers: { 'Content-Type': 'application/json' },
})

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

/** O AuthProvider registra aqui o que fazer quando o token expira. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

http.interceptors.request.use((config) => {
  const session = tokenStorage.get()
  if (session) config.headers.Authorization = `Bearer ${session.token}`
  return config
})

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const apiError = await toApiError(err)
    const isLogin = err?.config?.url?.includes('/auth/login')
    if (apiError.isUnauthorized && !isLogin) {
      tokenStorage.clear()
      onUnauthorized?.()
    }
    return Promise.reject(apiError)
  },
)

/** Extrai o nome do arquivo do cabeçalho Content-Disposition. */
export function filenameFromDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header)
  if (star) {
    try { return decodeURIComponent(star[1].trim().replace(/"/g, '')) } catch { /* segue */ }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1] : fallback
}

/** Dispara o download de um Blob no navegador. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
