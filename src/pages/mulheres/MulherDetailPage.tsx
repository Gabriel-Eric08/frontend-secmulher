import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Phone, Trash2 } from 'lucide-react'
import type { Mulher } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useDeleteMulher, useOverview } from '@/queries/records'
import { ageFrom, columnLabel, formatDate, formatDateTime, formatPhone } from '@/lib/format'
import { Avatar, DescriptionList, PageHeader } from '@/components/ui/Layout'
import { Badge, HiddenValue } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ErrorState, ForbiddenState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { RecordWorkspace } from '@/components/records/RecordWorkspace'

export function MulherDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { mulheresAccess: access } = useAuth()
  const overview = useOverview<Mulher>('clients', id)
  const del = useDeleteMulher()

  if (!access.canRead) return <ForbiddenState />
  if (overview.isPending) return <LoadingBlock />
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />

  const { record: m, activities, files } = overview.data
  const hidden = new Set(m.hiddenFields ?? [])
  const show = (col: string) => !hidden.has(col) && access.canReadColumn(col)
  const age = ageFrom(m.dataNascimento)

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir cadastro',
      message: (
        <>
          O cadastro de <strong>{m.nome ?? 'esta mulher'}</strong> e todos os seus documentos serão excluídos. O
          histórico permanece registrado para auditoria.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(m.id)
      toast.success('Cadastro excluído.')
      navigate('/mulheres', { replace: true })
    } catch (err) {
      toast.error(err)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Mulheres atendidas', to: '/mulheres' }, { label: m.nome ?? 'Cadastro' }]}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={m.nome} size="lg" />
            <span>
              {show('nome') ? m.nome : <HiddenValue />}
              <span className="mt-1.5 flex flex-wrap gap-2">
                {show('sob_risco') &&
                  (m.sobRisco ? <Badge tone="danger">Em situação de risco</Badge> : <Badge>Acompanhamento</Badge>)}
                {show('data_nascimento') && age != null && <Badge tone="brand">{age} anos</Badge>}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            {access.canUpdate && (
              <ButtonLink to={`/mulheres/${m.id}/editar`} variant="secondary" icon={<Pencil className="size-4" />}>
                Editar
              </ButtonLink>
            )}
            {access.canDelete && (
              <Button variant="danger-ghost" icon={<Trash2 className="size-4" />} onClick={onDelete} loading={del.isPending}>
                Excluir
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="space-y-6 lg:col-span-1">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Dados do cadastro</h2>
            <DescriptionList
              items={[
                {
                  label: 'Data de nascimento',
                  value: show('data_nascimento') ? formatDate(m.dataNascimento) : <HiddenValue />,
                },
                {
                  label: 'Telefone',
                  value: show('telefone') ? (
                    m.telefone ? (
                      <a href={`tel:${m.telefone.replace(/\D/g, '')}`} className="inline-flex items-center gap-1.5 text-brand-700 hover:underline">
                        <Phone className="size-3.5" /> {formatPhone(m.telefone)}
                      </a>
                    ) : (
                      '—'
                    )
                  ) : (
                    <HiddenValue />
                  ),
                },
                { label: 'Cadastrada em', value: formatDateTime(m.createdAt) },
                { label: 'Última alteração', value: formatDateTime(m.updatedAt) },
              ]}
            />
          </section>
        </aside>

        <div className="lg:col-span-2">
          <RecordWorkspace
            kind="clients"
            recordId={m.id}
            activities={activities}
            files={files}
            access={access}
            labelFor={columnLabel}
          />
        </div>
      </div>
    </>
  )
}
