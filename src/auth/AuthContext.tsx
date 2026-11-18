import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi, type CategoryAccess, type LoginRequest, type User, type UUID } from '@/api'
import { setUnauthorizedHandler } from '@/api/http'
import { tokenStorage } from '@/api/tokenStorage'
import { qk } from '@/queries/keys'
import { FINANCE_TABLE, MULHERES_TABLE, resolveAccess, type Access } from './access'

type Status = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: Status
  user: User | null
  isAdmin: boolean
  access: CategoryAccess[]
  login: (credentials: LoginRequest) => Promise<User>
  logout: () => void
  refresh: () => Promise<unknown>
  /** Acesso efetivo à categoria das mulheres atendidas */
  mulheresAccess: Access
  /** Acesso efetivo ao módulo financeiro (categoria nativa finance_actions) */
  financeAccess: Access
  accessFor: (categoryId: UUID) => Access
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [hasToken, setHasToken] = useState(() => !!tokenStorage.get())

  const me = useQuery({
    queryKey: qk.me,
    queryFn: authApi.me,
    enabled: hasToken,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const logout = useCallback(() => {
    tokenStorage.clear()
    setHasToken(false)
    qc.clear()
  }, [qc])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setHasToken(false)
      qc.clear()
    })
    return () => setUnauthorizedHandler(null)
  }, [qc])

  // Expiração do token no relógio local: encerra a sessão sem esperar um 401
  useEffect(() => {
    const session = tokenStorage.get()
    if (!hasToken || !session) return
    const ms = new Date(session.expiresAt).getTime() - Date.now()
    const t = setTimeout(logout, Math.max(ms, 0))
    return () => clearTimeout(t)
  }, [hasToken, logout])

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const res = await authApi.login(credentials)
      tokenStorage.set({ token: res.token, expiresAt: res.expiresAt })
      qc.clear()
      const data = await qc.fetchQuery({ queryKey: qk.me, queryFn: authApi.me })
      setHasToken(true)
      return data.user
    },
    [qc],
  )

  const value = useMemo<AuthContextValue>(() => {
    const user = me.data?.user ?? null
    const access = me.data?.access ?? []
    const isAdmin = !!user?.isGlobalAdmin
    let status: Status = 'anonymous'
    if (hasToken) status = me.isPending ? 'loading' : user ? 'authenticated' : 'anonymous'
    return {
      status,
      user,
      isAdmin,
      access,
      login,
      logout,
      refresh: () => qc.invalidateQueries({ queryKey: qk.me }),
      mulheresAccess: resolveAccess(isAdmin, access, { tableReference: MULHERES_TABLE }),
      financeAccess: resolveAccess(isAdmin, access, { tableReference: FINANCE_TABLE }),
      accessFor: (categoryId) => resolveAccess(isAdmin, access, { categoryId }),
    }
  }, [me.data, me.isPending, hasToken, login, logout, qc])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
