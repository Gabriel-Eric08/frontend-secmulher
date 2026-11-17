import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, type User, type UserRequest } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useSaveUser } from '@/queries/admin'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'

export function UserFormModal({
  open,
  onClose,
  user,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  user?: User | null
  onSaved?: (u: User) => void
}) {
  const toast = useToast()
  const { user: me } = useAuth()
  const save = useSaveUser()
  const isEdit = !!user
  const isSelf = user?.id === me?.id
  const [form, setForm] = useState<UserRequest>({ name: '', email: '', password: '', isGlobalAdmin: false, isActive: true })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      user
        ? { name: user.name, email: user.email, password: '', isGlobalAdmin: user.isGlobalAdmin, isActive: user.isActive }
        : { name: '', email: '', password: '', isGlobalAdmin: false, isActive: true },
    )
  }, [open, user])

  const set = <K extends keyof UserRequest>(k: K, v: UserRequest[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Informe o nome.'
    if (!form.email.trim()) errs.email = 'Informe o e-mail.'
    if (!isEdit && !form.password) errs.password = 'Defina uma senha inicial.'
    if (form.password && form.password.length < 6) errs.password = 'Mínimo de 6 caracteres.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const body: UserRequest = { ...form, name: form.name.trim(), email: form.email.trim() }
    if (!body.password) delete body.password
    try {
      const saved = await save.mutateAsync({ id: user?.id, body })
      toast.success(isEdit ? 'Funcionária atualizada.' : 'Funcionária cadastrada.')
      onSaved?.(saved)
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) setErrors({ email: 'Já existe um usuário com este e-mail.' })
      else if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar funcionária' : 'Nova funcionária'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" loading={save.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Field label="Nome" htmlFor="u-name" required error={errors.name}>
          <Input id="u-name" value={form.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="E-mail" htmlFor="u-email" required error={errors.email}>
          <Input
            id="u-email"
            type="email"
            autoComplete="off"
            value={form.email}
            invalid={!!errors.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
        <Field
          label={isEdit ? 'Nova senha' : 'Senha inicial'}
          htmlFor="u-pass"
          required={!isEdit}
          error={errors.password}
          hint={isEdit ? 'Deixe em branco para manter a senha atual.' : 'Mínimo de 6 caracteres.'}
        >
          <Input
            id="u-pass"
            type="password"
            autoComplete="new-password"
            value={form.password ?? ''}
            invalid={!!errors.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </Field>
        <div className="space-y-3 rounded-md border border-ink-200 p-3">
          <Checkbox
            label="Administradora"
            description="Acesso total: gerencia funcionárias, categorias e permissões."
            checked={form.isGlobalAdmin}
            disabled={isSelf}
            onChange={(e) => set('isGlobalAdmin', e.target.checked)}
          />
          <Checkbox
            label="Ativa"
            description="Usuárias inativas não conseguem entrar no sistema."
            checked={form.isActive}
            disabled={isSelf}
            onChange={(e) => set('isActive', e.target.checked)}
          />
          {isSelf && <p className="text-xs text-ink-500">Você não pode alterar o próprio perfil de acesso.</p>}
        </div>
      </form>
    </Modal>
  )
}
