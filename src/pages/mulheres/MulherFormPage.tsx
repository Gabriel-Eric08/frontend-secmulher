import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError, type Mulher, type MulherRequest } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useMulher, useSaveMulher } from '@/queries/records'
import { todayISO } from '@/lib/format'
import { Card, PageHeader } from '@/components/ui/Layout'
import { Button } from '@/components/ui/Button'
import { Field, Input, Switch } from '@/components/ui/Form'
import { Alert, ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

interface FormState {
  nome: string
  dataNascimento: string
  telefone: string
  sobRisco: boolean
}

const EMPTY: FormState = { nome: '', dataNascimento: '', telefone: '', sobRisco: false }

function fromMulher(m: Mulher): FormState {
  return {
    nome: m.nome ?? '',
    dataNascimento: m.dataNascimento ?? '',
    telefone: m.telefone ?? '',
    sobRisco: !!m.sobRisco,
  }
}

export function MulherFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const toast = useToast()
  const { mulheresAccess: access } = useAuth()
  const existing = useMulher(id)
  const save = useSaveMulher()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (existing.data) setForm(fromMulher(existing.data))
  }, [existing.data])

  if (isEdit ? !access.canUpdate : !access.canCreate) return <ForbiddenState />
  if (isEdit && existing.isPending) return <LoadingBlock />
  if (isEdit && existing.isError) return <ErrorState error={existing.error} />

  const hidden = new Set(existing.data?.hiddenFields ?? [])
  /** Campo exibido? (precisa poder ler; em criação, também precisa poder escrever) */
  const visible = (col: string) => !hidden.has(col) && access.canReadColumn(col) && (isEdit || access.canWriteColumn(col))
  const writable = (col: string) => access.canWriteColumn(col)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (visible('nome') && writable('nome')) {
      if (!form.nome.trim()) e.nome = 'Informe o nome.'
      else if (form.nome.length > 255) e.nome = 'Máximo de 255 caracteres.'
    }
    if (form.dataNascimento && form.dataNascimento >= todayISO()) e.dataNascimento = 'A data deve estar no passado.'
    if (form.telefone.length > 50) e.telefone = 'Máximo de 50 caracteres.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    // Só envia colunas visíveis: as ocultas são preservadas pelo backend,
    // e reenviar o valor atual de colunas sem escrita é aceito.
    const body: Partial<MulherRequest> = {}
    if (visible('nome')) body.nome = form.nome.trim()
    if (visible('data_nascimento')) body.dataNascimento = form.dataNascimento || null
    if (visible('telefone')) body.telefone = form.telefone.trim() || null
    if (visible('sob_risco')) body.sobRisco = form.sobRisco
    try {
      const saved = await save.mutateAsync({ id, body: body as MulherRequest })
      toast.success(isEdit ? 'Cadastro atualizado.' : 'Mulher cadastrada.')
      navigate(`/mulheres/${saved.id}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err)
    }
  }

  const title = isEdit ? 'Editar cadastro' : 'Novo cadastro'
  const hiddenCount = ['nome', 'data_nascimento', 'telefone', 'sob_risco'].filter((c) => !visible(c)).length

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: 'Mulheres atendidas', to: '/mulheres' },
          ...(isEdit ? [{ label: existing.data?.nome ?? 'Cadastro', to: `/mulheres/${id}` }] : []),
          { label: title },
        ]}
      />

      <form onSubmit={submit} className="max-w-2xl space-y-6">
        {hiddenCount > 0 && (
          <Alert>Alguns campos não aparecem porque seu perfil não tem permissão sobre eles.</Alert>
        )}

        <Card title="Dados pessoais">
          <div className="grid gap-5 sm:grid-cols-2">
            {visible('nome') && (
              <Field
                label="Nome completo"
                htmlFor="nome"
                required
                error={errors.nome}
                locked={!writable('nome')}
                className="sm:col-span-2"
              >
                <Input
                  id="nome"
                  value={form.nome}
                  maxLength={255}
                  disabled={!writable('nome')}
                  invalid={!!errors.nome}
                  onChange={(e) => set('nome', e.target.value)}
                />
              </Field>
            )}
            {visible('data_nascimento') && (
              <Field
                label="Data de nascimento"
                htmlFor="nasc"
                error={errors.dataNascimento}
                locked={!writable('data_nascimento')}
              >
                <Input
                  id="nasc"
                  type="date"
                  max={todayISO()}
                  value={form.dataNascimento}
                  disabled={!writable('data_nascimento')}
                  invalid={!!errors.dataNascimento}
                  onChange={(e) => set('dataNascimento', e.target.value)}
                />
              </Field>
            )}
            {visible('telefone') && (
              <Field label="Telefone" htmlFor="tel" error={errors.telefone} locked={!writable('telefone')}>
                <Input
                  id="tel"
                  type="tel"
                  inputMode="tel"
                  placeholder="(81) 90000-0000"
                  maxLength={50}
                  value={form.telefone}
                  disabled={!writable('telefone')}
                  invalid={!!errors.telefone}
                  onChange={(e) => set('telefone', e.target.value)}
                />
              </Field>
            )}
          </div>
        </Card>

        {visible('sob_risco') && (
          <Card title="Situação">
            <Switch
              checked={form.sobRisco}
              onChange={(v) => set('sobRisco', v)}
              disabled={!writable('sob_risco')}
              label={
                <span>
                  <span className="font-medium">Em situação de risco</span>
                  <span className="block text-xs text-ink-500">
                    Sinaliza o cadastro para prioridade de acompanhamento.
                  </span>
                </span>
              }
            />
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {isEdit ? 'Salvar alterações' : 'Cadastrar'}
          </Button>
        </div>
      </form>
    </>
  )
}
