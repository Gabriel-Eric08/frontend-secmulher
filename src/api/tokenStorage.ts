const KEY = 'secmulher.session'

export interface StoredSession {
  token: string
  expiresAt: string
}

export const tokenStorage = {
  get(): StoredSession | null {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      const session = JSON.parse(raw) as StoredSession
      if (!session.token || new Date(session.expiresAt).getTime() <= Date.now()) {
        localStorage.removeItem(KEY)
        return null
      }
      return session
    } catch {
      return null
    }
  },
  set(session: StoredSession) {
    try {
      localStorage.setItem(KEY, JSON.stringify(session))
    } catch {
      /* armazenamento indisponível: sessão só em memória */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* noop */
    }
  },
}
