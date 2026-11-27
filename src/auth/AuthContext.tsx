import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi, type CategoryAccess, type LoginRequest, type User, type UUID } from '@/api'
import { setUnauthorizedHandler } from '@/api/http'
import { sessionExpiry, sessionNotice, tokenStorage } from '@/api/tokenStorage'
import { qk } from '@/queries/keys'
import { AMENDMENTS_TABLE, FINANCE_TABLE, FLEET_TABLE, MULHERES_TABLE, TASKS_TABLE, resolveAccess, type Access } from './access'

/** error = há token, mas não foi possível carregar /auth/me (servidor fora, erro 500…) */
type Status = 'loading' | 'authenticated' | 'anonymous' | 'error'

interface AuthContextValue {
  status: Status
  /** Erro ao carregar a sessão, quando status = 'error' */
  sessionError: unknown
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
  /** Acesso efetivo ao módulo de frotas (categoria nativa fleet_trips) */
  fleetAccess: Access
  /** Acesso efetivo ao módulo de emendas (categoria nativa amendments) */
  amendmentsAccess: Access
  /**
   * Acesso efetivo ao módulo de tarefas (categoria nativa tasks). O responsável pela tarefa
   * e o dono da meta acompanham mesmo sem edição: ver `canManageGoal`/`canTrackTask` em lib/tasks.
   */
  tasksAccess: Access
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
    setUnauthorizedHandler((detail) => {
      sessionNotice.set(detail ? `Sessão encerrada pelo servidor: ${detail}` : 'Sua sessão foi encerrada. Entre novamente.')
      setHasToken(false)
      qc.clear()
    })
    return () => setUnauthorizedHandler(null)
  }, [qc])

  // Expiração do token no relógio local: encerra a sessão sem esperar um 401.
  // Sem validade conhecida, não agenda nada (o backend responde 401 quando expirar).
  useEffect(() => {
    const session = tokenStorage.get()
    if (!hasToken || !session) return
    const exp = sessionExpiry(session)
    if (exp === null) return
    // setTimeout estoura acima de ~24,8 dias e dispararia na hora
    const ms = Math.min(Math.max(exp - Date.now(), 0), 2 ** 31 - 1)
    const t = setTimeout(() => {
      sessionNotice.set('Sua sessão expirou. Entre novamente.')
      logout()
    }, ms)
    return () => clearTimeout(t)
  }, [hasToken, logout])

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const res = await authApi.login(credentials)
      sessionNotice.clear()
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
    if (hasToken) status = me.isPending ? 'loading' : user ? 'authenticated' : me.isError ? 'error' : 'anonymous'
    return {
      status,
      sessionError: me.error,
      user,
      isAdmin,
      access,
      login,
      logout,
      refresh: () => qc.invalidateQueries({ queryKey: qk.me }),
      mulheresAccess: resolveAccess(isAdmin, access, { tableReference: MULHERES_TABLE }),
      financeAccess: resolveAccess(isAdmin, access, { tableReference: FINANCE_TABLE }),
      fleetAccess: resolveAccess(isAdmin, access, { tableReference: FLEET_TABLE }),
      amendmentsAccess: resolveAccess(isAdmin, access, { tableReference: AMENDMENTS_TABLE }),
      tasksAccess: resolveAccess(isAdmin, access, { tableReference: TASKS_TABLE }),
      accessFor: (categoryId) => resolveAccess(isAdmin, access, { categoryId }),
    }
  }, [me.data, me.isPending, me.isError, me.error, hasToken, login, logout, qc])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
