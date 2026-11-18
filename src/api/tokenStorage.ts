const KEY = 'secmulher.session'
const NOTICE_KEY = 'secmulher.session-notice'

export interface StoredSession {
  token: string
  expiresAt: string
}

/** `exp` (segundos) de dentro do JWT, ou null se não der para ler. */
function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Momento (ms) em que a sessão expira. O `exp` do JWT é a fonte mais confiável; o
 * `expiresAt` da resposta é reserva e pode vir como ISO ou número (segundos ou ms).
 * Devolve null quando não há como saber: nesse caso quem decide é o backend (401).
 */
export function sessionExpiry(session: StoredSession): number | null {
  const fromJwt = jwtExpiry(session.token)
  if (fromJwt) return fromJwt
  const raw: unknown = session.expiresAt
  if (typeof raw === 'number') return raw < 1e12 ? raw * 1000 : raw
  if (typeof raw === 'string') {
    const asNumber = Number(raw)
    if (raw.trim() !== '' && !Number.isNaN(asNumber)) return asNumber < 1e12 ? asNumber * 1000 : asNumber
    const t = Date.parse(raw)
    if (!Number.isNaN(t)) return t
  }
  return null
}

export const tokenStorage = {
  get(): StoredSession | null {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      const session = JSON.parse(raw) as StoredSession
      const exp = session.token ? sessionExpiry(session) : 0
      if (!session.token || (exp !== null && exp <= Date.now())) {
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

/**
 * Aviso de por que a sessão terminou (token expirado, 401 do backend…), mostrado
 * uma única vez na tela de login. Sem ele, a volta ao login seria silenciosa.
 */
export const sessionNotice = {
  set(message: string) {
    try {
      sessionStorage.setItem(NOTICE_KEY, message)
    } catch {
      /* noop */
    }
  },
  peek(): string | null {
    try {
      return sessionStorage.getItem(NOTICE_KEY)
    } catch {
      return null
    }
  },
  consume(): string | null {
    try {
      const m = sessionStorage.getItem(NOTICE_KEY)
      sessionStorage.removeItem(NOTICE_KEY)
      return m
    } catch {
      return null
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(NOTICE_KEY)
    } catch {
      /* noop */
    }
  },
}
