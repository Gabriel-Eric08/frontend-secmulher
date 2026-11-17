import { http } from './http'
import type { ChangePasswordRequest, LoginRequest, LoginResponse, MeResponse } from './types'

export const authApi = {
  login: (body: LoginRequest) => http.post<LoginResponse>('/auth/login', body).then((r) => r.data),
  me: () => http.get<MeResponse>('/auth/me').then((r) => r.data),
  changePassword: (body: ChangePasswordRequest) =>
    http.put<void>('/auth/me/password', body).then(() => undefined),
}
