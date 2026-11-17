import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ApiError, authApi } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { CONFIDENTIALITY_LABEL, columnLabel } from '@/lib/format'
import { Avatar, Card, PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { ActionFlags } from '@/components/admin/PermissionSummary'

export function PerfilPage() {
  const { user, isAdmin, access } = useAuth()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const change = useMutation({ mutationFn: authApi.changePassword })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!current) errs.current = 'Informe a senha atual.'
    if (next.length < 6) errs.next = 'Mínimo de 6 caracteres.'
    if (next !== confirmPass) errs.confirm = 'As senhas não coincidem.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next })
      toast.success('Senha alterada.')
      setCurrent('')
      setNext('')
      setConfirmPass('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors({ current: 'Senha atual incorreta.' })
      else toast.error(err)
    }
  }

  return (
    <>
      <PageHeader title="Minha conta" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <div className="flex items-center gap-4">
              <Avatar name={user?.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{user?.name}</p>
                <p className="truncate text-sm text-ink-500">{user?.email}</p>
                <div className="mt-2">{isAdmin ? <Badge tone="brand">Administradora</Badge> : <Badge>Equipe</Badge>}</div>
              </div>
            </div>
          </Card>

          <Card title="Alterar senha">
            <form onSubmit={submit} className="space-y-4">
              <Field label="Senha atual" htmlFor="pw-cur" error={errors.current}>
                <Input id="pw-cur" type="password" autoComplete="current-password" value={current} invalid={!!errors.current} onChange={(e) => setCurrent(e.target.value)} />
              </Field>
              <Field label="Nova senha" htmlFor="pw-new" error={errors.next}>
                <Input id="pw-new" type="password" autoComplete="new-password" value={next} invalid={!!errors.next} onChange={(e) => setNext(e.target.value)} />
              </Field>
              <Field label="Confirmar nova senha" htmlFor="pw-conf" error={errors.confirm}>
                <Input id="pw-conf" type="password" autoComplete="new-password" value={confirmPass} invalid={!!errors.confirm} onChange={(e) => setConfirmPass(e.target.value)} />
              </Field>
              <Button type="submit" loading={change.isPending} className="w-full">
                Alterar senha
              </Button>
            </form>
          </Card>
        </div>

        <Card className="lg:col-span-2" title="Meus acessos" description="Definidos pela administração." padded={false}>
          {isAdmin ? (
            <p className="p-5 text-sm text-ink-600">Como administradora, você tem acesso total ao sistema.</p>
          ) : access.length === 0 ? (
            <EmptyState title="Nenhum acesso concedido" description="Procure a coordenação para liberar seu acesso." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {access.map((a) => {
                const label = a.tableReference === 'clients' ? columnLabel : (c: string) => c
                return (
                  <li key={a.categoryId} className="space-y-2 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink-900">{a.categoryName}</p>
                      <ActionFlags p={a} />
                    </div>
                    <p className="text-xs text-ink-500">
                      Colunas visíveis: {a.allowedColumns?.read ? a.allowedColumns.read.map(label).join(', ') || 'nenhuma' : 'todas'} ·
                      Documentos até: {CONFIDENTIALITY_LABEL[a.maxConfidentiality]}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
