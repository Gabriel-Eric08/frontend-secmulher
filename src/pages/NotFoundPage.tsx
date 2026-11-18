import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, Home } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { StatusScreen } from '@/components/ui/StatusScreen'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (
    <StatusScreen
      icon={<Compass />}
      code="404"
      title="Página não encontrada"
      description="O endereço acessado não existe, mudou de lugar ou foi removido."
      actions={
        <>
          <Button variant="secondary" icon={<ArrowLeft className="size-4" />} onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <ButtonLink to="/" icon={<Home className="size-4" />}>
            Ir para o painel
          </ButtonLink>
        </>
      }
    >
      <code className="mt-4 max-w-full truncate rounded-lg bg-ink-100 px-3 py-1.5 font-mono text-xs text-ink-500">
        {pathname}
      </code>
    </StatusScreen>
  )
}
