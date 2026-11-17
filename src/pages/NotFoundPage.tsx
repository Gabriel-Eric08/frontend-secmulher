import { ButtonLink } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="text-5xl font-semibold text-brand-700">404</p>
      <p className="mt-3 font-medium text-ink-800">Página não encontrada</p>
      <p className="mt-1 text-sm text-ink-500">O endereço acessado não existe ou foi removido.</p>
      <ButtonLink to="/" variant="secondary" className="mt-6">
        Voltar ao painel
      </ButtonLink>
    </div>
  )
}
