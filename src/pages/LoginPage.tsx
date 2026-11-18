import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { ApiError, errorMessage } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { BrandMark } from '@/components/layout/BrandMark'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { Alert } from '@/components/ui/States'
import { ThemeToggle } from '@/theme/ThemeToggle'
import { sessionNotice } from '@/api/tokenStorage'

export function LoginPage() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // motivo de a sessão anterior ter terminado (lido uma vez ao abrir a tela)
  const [notice] = useState(() => sessionNotice.peek())
  useEffect(() => sessionNotice.clear(), [])

  if (status === 'authenticated') return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email: email.trim(), password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError && err.isUnauthorized ? 'E-mail ou senha incorretos.' : errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface lg:flex-row">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#461f68] p-10 text-white dark:bg-institutional lg:flex lg:w-[44%]">
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border-[48px] border-white/[0.06]" />
        <div className="pointer-events-none absolute top-24 -right-10 size-40 rounded-full border-[20px] border-white/[0.05]" />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10 [&_rect]:fill-white/15" />
          <div className="leading-tight">
            <p className="text-xs font-medium tracking-wider text-white/60 uppercase">Governo de Pernambuco</p>
            <p className="font-semibold">Secretaria da Mulher</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl leading-tight font-semibold">Sistema de Atendimento às Mulheres</h1>
          <p className="mt-4 text-white/80">
            Cadastro, acompanhamento e rede de apoio em um só lugar, com sigilo e controle de acesso por perfil
            profissional.
          </p>
        </div>
        <p className="relative text-xs text-white/55">
          Acesso restrito a servidoras e servidores autorizados. Todas as ações são registradas.
        </p>
      </div>

      <div className="relative flex flex-1 flex-col">
        <ThemeToggle className="absolute top-10 right-3 z-10 lg:top-5 lg:right-5" />
        <div className="bg-institutional px-4 py-1.5 text-[11px] font-medium tracking-wider text-white/75 uppercase lg:hidden">
          Governo do Estado de Pernambuco
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm animate-fade-up">
            <div className="mb-8 lg:hidden">
              <BrandMark className="size-10" />
              <p className="mt-3 font-semibold text-brand-800">Secretaria da Mulher</p>
            </div>
            <h2 className="text-xl font-semibold text-ink-900">Entrar</h2>
            <p className="mt-1 text-sm text-ink-500">Use seu e-mail institucional e senha.</p>

            <form onSubmit={submit} className="mt-8 space-y-4">
              {error ? <Alert tone="danger">{error}</Alert> : notice && <Alert tone="warning">{notice}</Alert>}
              <Field label="E-mail" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Senha" htmlFor="password">
                <div className="relative">
                  <Input
                    id="password"
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"
                    aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>
              <Button type="submit" className="w-full" loading={loading} icon={<LockKeyhole className="size-4" />}>
                Entrar
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
