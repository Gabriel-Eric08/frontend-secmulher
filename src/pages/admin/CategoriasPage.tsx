import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ListChecks, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { ApiError, type Category, type CategoryRequest } from '@/api'
import { MULHERES_TABLE } from '@/auth/access'
import { useCategories, useDeleteCategory } from '@/queries/admin'
import { PageHeader } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton, buttonClass } from '@/components/ui/Button'
import { Alert, EmptyState, ErrorState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { AMENDMENTS_CATEGORY_PRESET, CategoryFormModal, FINANCE_CATEGORY_PRESET, FLEET_CATEGORY_PRESET, MULHERES_CATEGORY_PRESET } from '@/components/admin/CategoryFormModal'

export function CategoriasPage() {
  const categories = useCategories()
  const del = useDeleteCategory()
  const confirm = useConfirm()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [modal, setModal] = useState<{ open: boolean; category?: Category | null; preset?: CategoryRequest }>({ open: false })

  useEffect(() => {
    if (params.get('setup') === 'mulheres') {
      setModal({ open: true, preset: MULHERES_CATEGORY_PRESET })
      setParams({}, { replace: true })
    } else if (params.get('setup') === 'financeiro') {
      setModal({ open: true, preset: FINANCE_CATEGORY_PRESET })
      setParams({}, { replace: true })
    } else if (params.get('setup') === 'frotas') {
      setModal({ open: true, preset: FLEET_CATEGORY_PRESET })
      setParams({}, { replace: true })
    } else if (params.get('setup') === 'emendas') {
      setModal({ open: true, preset: AMENDMENTS_CATEGORY_PRESET })
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const list = [...(categories.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const hasMulheres = list.some((c) => c.entityType === 'native' && c.tableReference === MULHERES_TABLE)

  const onDelete = async (c: Category) => {
    const ok = await confirm({
      title: 'Excluir categoria',
      message: (
        <>
          A categoria <strong>{c.name}</strong> e suas permissões serão excluídas. Categorias com registros não podem
          ser excluídas: desative-as.
        </>
      ),
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    try {
      await del.mutateAsync(c.id)
      toast.success('Categoria excluída.')
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.isConflict
          ? 'A categoria ainda tem registros. Exclua-os ou desative a categoria.'
          : err,
      )
    }
  }

  return (
    <>
      <PageHeader
        title="Categorias e campos"
        description="Tipos de cadastro do sistema e os campos de cada formulário."
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setModal({ open: true })}>
            Nova categoria
          </Button>
        }
      />

      {categories.isSuccess && !hasMulheres && (
        <div className="mb-4">
          <Alert
            tone="warning"
            title="Categoria de mulheres atendidas não encontrada"
            action={
              <Button size="sm" variant="secondary" onClick={() => setModal({ open: true, preset: MULHERES_CATEGORY_PRESET })}>
                Criar categoria
              </Button>
            }
          >
            Necessária para conceder à equipe acesso aos cadastros das mulheres.
          </Alert>
        </div>
      )}

      <div className="card">
        {categories.isPending ? (
          <LoadingBlock />
        ) : categories.isError ? (
          <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState title="Nenhuma categoria" description="Crie categorias como Abrigos, Cursos ou Municípios parceiros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Referência</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-ink-900">
                      {c.entityType === 'dynamic' ? (
                        <Link to={`/admin/categorias/${c.id}/campos`} className="hover:text-brand-700">
                          {c.name}
                        </Link>
                      ) : (
                        c.name
                      )}
                    </td>
                    <td>{c.entityType === 'dynamic' ? <Badge tone="brand">Dinâmica</Badge> : <Badge>Nativa</Badge>}</td>
                    <td>
                      <code className="text-xs text-ink-600">{c.tableReference}</code>
                    </td>
                    <td>{c.isActive ? <Badge tone="success">Ativa</Badge> : <Badge>Inativa</Badge>}</td>
                    <td className="text-right whitespace-nowrap">
                      {c.entityType === 'dynamic' && (
                        <Link to={`/admin/categorias/${c.id}/campos`} className={buttonClass('ghost', 'sm')}>
                          <ListChecks className="size-4" /> Campos
                        </Link>
                      )}
                      <Link to={`/admin/categorias/${c.id}/tipos`} className={buttonClass('ghost', 'sm', 'mr-1')}>
                        <Tags className="size-4" /> Tipos de registro
                      </Link>
                      <IconButton label="Editar" onClick={() => setModal({ open: true, category: c })}>
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton label="Excluir" variant="danger-ghost" onClick={() => onDelete(c)}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CategoryFormModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        category={modal.category}
        preset={modal.preset}
      />
    </>
  )
}
