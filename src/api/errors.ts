import axios from 'axios'
import type { ProblemDetails } from './types'

/** Erro normalizado de qualquer chamada à API. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string
  readonly fieldErrors: Record<string, string>
  readonly problem?: ProblemDetails

  constructor(status: number, detail: string, fieldErrors: Record<string, string> = {}, problem?: ProblemDetails) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.fieldErrors = fieldErrors
    this.problem = problem
  }

  get isUnauthorized() { return this.status === 401 }
  get isForbidden() { return this.status === 403 }
  get isNotFound() { return this.status === 404 }
  get isConflict() { return this.status === 409 }
  get isValidation() { return this.status === 400 }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
  400: 'Dados inválidos.',
  401: 'Sessão expirada. Entre novamente.',
  403: 'Você não tem permissão para esta ação.',
  404: 'Registro não encontrado.',
  409: 'Conflito com dados existentes.',
  413: 'Arquivo acima do limite de 20 MB.',
  422: 'Não foi possível concluir a operação.',
  500: 'Erro interno do servidor.',
}

export async function toApiError(err: unknown): Promise<ApiError> {
  if (err instanceof ApiError) return err
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 0
    let data: unknown = err.response?.data
    // Respostas de erro em downloads (responseType: blob) chegam como Blob
    if (data instanceof Blob) {
      try { data = JSON.parse(await data.text()) } catch { data = undefined }
    }
    const problem = (data && typeof data === 'object' ? data : undefined) as ProblemDetails | undefined
    const detail = problem?.detail || DEFAULT_MESSAGES[status] || err.message
    return new ApiError(status, detail, problem?.errors ?? {}, problem)
  }
  if (err instanceof Error) return new ApiError(0, err.message)
  return new ApiError(0, 'Erro inesperado.')
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.detail
  if (err instanceof Error) return err.message
  return 'Erro inesperado.'
}
