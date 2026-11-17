import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError, type Category, type ConfidentialityLevel, type Permission, type PermissionRequest, type User, type UUID } from '@/api'
import { CONFIDENTIALITY_ORDER, MULHERES_TABLE } from '@/auth/access'
import { useActivityTypes, useFields, useSavePermission } from '@/queries/admin'
import { CONFIDENTIALITY_HINT, CONFIDENTIALITY_LABEL, MULHER_COLUMNS } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Select } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'

interface ColumnOption {
  column: string
  label: string
}

function ColumnPicker({
  title,
  description,
  options,
  value,
  onChange,
  allLabel = 'Todas as colunas',
}: {
  title: string
  description: string
  allLabel?: string
  options: ColumnOption[]
  /** null = todas as colunas (chave ausente em allowedColumns) */
  value: string[] | null
  onChange: (v: string[] | null) => void
}) {
  const restricted = value !== null
  return (
    <div className="rounded-md border border-ink-200 p-3">
      <p className="text-sm font-medium text-ink-800">{title}</p>
      <p className="mb-3 text-xs text-ink-500">{description}</p>
      <div className="mb-3 flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" className="accent-brand-700" checked={!restricted} onChange={() => onChange(null)} />
          {allLabel}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            className="accent-brand-700"
            checked={restricted}
            onChange={() => onChange(options.map((o) => o.column))}
          />
          Somente selecionadas
        </label>
      </div>
      {restricted && (
        <div className="grid gap-2 border-t border-ink-100 pt-3 sm:grid-cols-2">
          {options.length === 0 && <p className="text-xs text-ink-500">Nada cadastrado nesta categoria ainda.</p>}
          {options.map((o) => (
            <Checkbox
              key={o.column}
              label={o.label}
              description={<code className="text-[11px]">{o.column}</code>}
              checked={value!.includes(o.column)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value!, o.column] : value!.filter((c) => c !== o.column))
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function PermissionModal({
  open,
  onClose,
  permission,
  userId: fixedUserId,
  users,
  categories,
  existing,
}: {
  open: boolean
  onClose: () => void
  permission?: Permission | null
  userId?: UUID
  users?: User[]
  categories: Category[]
  /** Permissões já existentes, para evitar duplicar o par usuária/categoria */
  existing: Permission[]
}) {
  const toast = useToast()
  const save = useSavePermission()
  const isEdit = !!permission

  const [userId, setUserId] = useState<UUID>('')
  const [categoryId, setCategoryId] = useState<UUID>('')
  const [flags, setFlags] = useState({ canRead: true, canCreate: false, canUpdate: false, canDelete: false })
  const [read, setRead] = useState<string[] | null>(null)
  const [write, setWrite] = useState<string[] | null>(null)
  const [maxConf, setMaxConf] = useState<ConfidentialityLevel>('INTERNAL')
  /** keys dos tipos de registro liberados; null = todos */
  const [atypes, setAtypes] = useState<string[] | null>(null)

  useEffect(() => {
    if (!open) return
    setUserId(permission?.userId ?? fixedUserId ?? '')
    setCategoryId(permission?.categoryId ?? '')
    setFlags({
      canRead: permission?.canRead ?? true,
      canCreate: permission?.canCreate ?? false,
      canUpdate: permission?.canUpdate ?? false,
      canDelete: permission?.canDelete ?? false,
    })
    setRead(permission?.allowedColumns?.read ?? null)
    setWrite(permission?.allowedColumns?.write ?? null)
    setMaxConf(permission?.maxConfidentiality ?? 'INTERNAL')
    setAtypes(permission?.allowedActivityTypes?.length ? permission.allowedActivityTypes : null)
  }, [open, permission, fixedUserId])

  const category = categories.find((c) => c.id === categoryId)
  const isDynamic = category?.entityType === 'dynamic'
  const fields = useFields(categoryId || undefined, open && isDynamic)
  const activityTypes = useActivityTypes(categoryId || undefined, { includeInactive: true, enabled: open })
  const typeOptions = useMemo<ColumnOption[]>(
    () =>
      (activityTypes.data ?? []).map((t) => ({ column: t.key, label: t.isActive ? t.label : `${t.label} (inativo)` })),
    [activityTypes.data],
  )

  const columnOptions = useMemo<ColumnOption[]>(() => {
    if (!category) return []
    if (category.entityType === 'native' && category.tableReference === MULHERES_TABLE)
      return MULHER_COLUMNS.map((c) => ({ column: c.column, label: c.label }))
    return (fields.data ?? []).map((f) => ({ column: f.key, label: f.label }))
  }, [category, fields.data])

  const takenCategories = new Set(
    existing.filter((p) => p.userId === userId && p.id !== permission?.id).map((p) => p.categoryId),
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId || !categoryId) return toast.error('Selecione a funcionária e a categoria.')
    // [] na API significa "todos"; uma restrição vazia não faz sentido
    if (atypes !== null && atypes.length === 0)
      return toast.error('Selecione ao menos um tipo de registro, ou libere todos.')
    const allowedColumns: PermissionRequest['allowedColumns'] = {}
    if (read !== null) allowedColumns.read = read
    if (write !== null) allowedColumns.write = write
    try {
      await save.mutateAsync({
        id: permission?.id,
        body: {
          userId,
          categoryId,
          ...flags,
          allowedColumns,
          maxConfidentiality: maxConf,
          allowedActivityTypes: atypes ?? [],
        },
      })
      toast.success('Permissão salva.')
      onClose()
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.isConflict ? 'Esta funcionária já tem permissão nesta categoria.' : err,
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Editar permissão' : 'Nova permissão'}
      description="Define o que a funcionária pode fazer em uma categoria."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="perm-form" loading={save.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="perm-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {!fixedUserId && users && (
            <Field label="Funcionária" htmlFor="p-user" required>
              <Select id="p-user" value={userId} disabled={isEdit} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Selecione…</option>
                {users
                  .filter((u) => !u.isGlobalAdmin)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          <Field label="Categoria" htmlFor="p-cat" required>
            <Select
              id="p-cat"
              value={categoryId}
              disabled={isEdit}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setRead(null)
                setWrite(null)
              }}
            >
              <option value="">Selecione…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} disabled={takenCategories.has(c.id)}>
                  {c.name}
                  {takenCategories.has(c.id) ? ' (já concedida)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <p className="label">Ações permitidas</p>
          <div className="grid grid-cols-2 gap-3 rounded-md border border-ink-200 p-3 sm:grid-cols-4">
            <Checkbox label="Ler" checked={flags.canRead} onChange={(e) => setFlags((f) => ({ ...f, canRead: e.target.checked }))} />
            <Checkbox label="Criar" checked={flags.canCreate} onChange={(e) => setFlags((f) => ({ ...f, canCreate: e.target.checked }))} />
            <Checkbox label="Editar" checked={flags.canUpdate} onChange={(e) => setFlags((f) => ({ ...f, canUpdate: e.target.checked }))} />
            <Checkbox label="Excluir" checked={flags.canDelete} onChange={(e) => setFlags((f) => ({ ...f, canDelete: e.target.checked }))} />
          </div>
          <p className="mt-1 text-xs text-ink-500">Registrar atendimentos e anexar documentos exige permissão de edição.</p>
        </div>

        {category && (
          <div className="grid gap-4 lg:grid-cols-2">
            <ColumnPicker
              title="Colunas visíveis"
              description="Colunas não selecionadas aparecem como restritas."
              options={columnOptions}
              value={read}
              onChange={setRead}
            />
            <ColumnPicker
              title="Colunas editáveis"
              description="Colunas que a funcionária pode preencher ou alterar."
              options={columnOptions}
              value={write}
              onChange={setWrite}
            />
          </div>
        )}

        {category && (
          <ColumnPicker
            title="Tipos de registro na linha do tempo"
            description="Quais tipos ela pode registrar (exige permissão de edição). Ela continua vendo todos na linha do tempo."
            allLabel="Todos os tipos"
            options={typeOptions}
            value={atypes}
            onChange={setAtypes}
          />
        )}

        <Field label="Nível máximo de sigilo de documentos" htmlFor="p-conf" hint={CONFIDENTIALITY_HINT[maxConf]}>
          <Select id="p-conf" value={maxConf} onChange={(e) => setMaxConf(e.target.value as ConfidentialityLevel)}>
            {CONFIDENTIALITY_ORDER.map((l) => (
              <option key={l} value={l}>
                {CONFIDENTIALITY_LABEL[l]}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  )
}
