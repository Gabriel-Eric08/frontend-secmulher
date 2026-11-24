import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { UserCheck, X } from 'lucide-react'
import { ApiError, type Amendment, type AmendmentOptions, type AmendmentRequest } from '@/api'
import { useAuth } from '@/auth/AuthContext'
import { useUsers } from '@/queries/admin'
import { useAmendment, useAmendmentOptions, useAmendmentSectors, useSaveAmendment } from '@/queries/amendments'
import { ALL_SHEET_FIELDS, SHEET_SECTIONS, amendmentTitle, isClosed, type SheetField } from '@/lib/amendments'
import { PageHeader } from '@/components/ui/Layout'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Alert, ErrorState, ForbiddenState } from '@/components/ui/States'
import { PageSkeleton } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { MoneyInput } from '@/components/finance/MoneyInput'

type Errors = Record<string, string>
type SheetValues = Record<string, string>

/** Campos com sugestões dos valores já usados (mantém a grafia da planilha consistente). */
const SUGGESTIONS: Partial<Record<string, keyof AmendmentOptions>> = {
  cycle: 'cycles',
  municipality: 'municipalities',
  category: 'categories',
  type: 'types',
  technicalArea: 'technicalAreas',
}

const emptySheet = (): SheetValues => Object.fromEntries(ALL_SHEET_FIELDS.map((f) => [f.key, '']))

function sheetFrom(a: Amendment): SheetValues {
  return Object.fromEntries(ALL_SHEET_FIELDS.map((f) => [f.key, (a[f.key] as string | null) ?? '']))
}

export function EmendaFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const toast = useToast()
  const { amendmentsAccess: access, user, isAdmin } = useAuth()
  const existing = useAmendment(id)
  const options = useAmendmentOptions(access.canRead)
  const sectors = useAmendmentSectors(access.canRead)
  // Escolher outra usuária como responsável exige a lista de usuários, que só a administração enxerga
  const users = useUsers(isAdmin)
  const save = useSaveAmendment()

  const [exerciseYear, setExerciseYear] = useState(String(new Date().getFullYear()))
  const [parliamentarian, setParliamentarian] = useState('')
  const [currentAmount, setCurrentAmount] = useState<number | null>(null)
  const [sectorId, setSectorId] = useState('')
  const [responsibleUserId, setResponsibleUserId] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [sheet, setSheet] = useState<SheetValues>(emptySheet)
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [loaded, setLoaded] = useState(!isEdit)

  useEffect(() => {
    const a = existing.data
    if (!a || loaded) return
    setExerciseYear(String(a.exerciseYear))
    setParliamentarian(a.parliamentarian)
    setCurrentAmount(a.currentAmount)
    setSectorId(a.sector?.id ?? '')
    setResponsibleUserId(a.responsibleUser?.id ?? '')
    setResponsibleName(a.responsibleName ?? '')
    setSheet(sheetFrom(a))
    setLoaded(true)
  }, [existing.data, loaded])

  if (!(isEdit ? access.canUpdate : access.canCreate))
    return <ForbiddenState message="Seu perfil não pode cadastrar ou editar emendas." />
  if (isEdit && existing.isPending) return <PageSkeleton />
  if (isEdit && existing.isError) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
  if (isEdit && existing.data && isClosed(existing.data.status))
    return (
      <div className="card">
        <ErrorState error={new Error('Emenda concluída ou cancelada não pode ser editada. Reabra antes.')} />
      </div>
    )

  const setField = (key: string, v: string) => setSheet((s) => ({ ...s, [key]: v }))
  const linkedName =
    responsibleUserId === user?.id
      ? user?.name
      : (users.data?.find((u) => u.id === responsibleUserId)?.name ?? existing.data?.responsibleUser?.name)

  const assignTo = (uid: string, name: string | undefined) => {
    setResponsibleUserId(uid)
    if (uid && name) setResponsibleName(name)
  }

  const validate = (): Errors => {
    const e: Errors = {}
    const year = Number(exerciseYear)
    if (!exerciseYear || !Number.isInteger(year) || year < 2000 || year > 2100) e.exerciseYear = 'Informe um ano entre 2000 e 2100.'
    if (!parliamentarian.trim()) e.parliamentarian = 'Informe o parlamentar.'
    return e
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    const body: AmendmentRequest = {
      exerciseYear: Number(exerciseYear),
      parliamentarian: parliamentarian.trim(),
      currentAmount,
      sectorId: sectorId || null,
      responsibleUserId: responsibleUserId || null,
      responsibleName: responsibleName.trim() || undefined,
      ...Object.fromEntries(ALL_SHEET_FIELDS.map((f) => [f.key, sheet[f.key]?.trim() || undefined])),
      ...(isEdit && comment.trim() ? { comment: comment.trim() } : {}),
    }
    try {
      const saved = await save.mutateAsync({ id, body })
      toast.success(isEdit ? 'Emenda atualizada.' : 'Emenda cadastrada.')
      navigate(`/emendas/${saved.id}`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.isConflict) {
        setErrors({ code: 'Já existe uma emenda com este código neste ano.' })
        document.getElementById('f-code')?.focus()
      } else if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else toast.error(err)
    }
  }

  const specials: Record<string, ReactNode> = {
    exerciseYear: (
      <Field label="Ano (LOA)" htmlFor="f-exerciseYear" required error={errors.exerciseYear} hint="Planilha: LOA">
        <Input id="f-exerciseYear" type="number" min={2000} max={2100} value={exerciseYear} invalid={!!errors.exerciseYear} onChange={(e) => setExerciseYear(e.target.value)} />
      </Field>
    ),
    parliamentarian: (
      <Field label="Parlamentar" htmlFor="f-parliamentarian" required error={errors.parliamentarian} hint="Planilha: PARLAMENTAR">
        <Input
          id="f-parliamentarian"
          maxLength={255}
          list="dl-parliamentarians"
          value={parliamentarian}
          invalid={!!errors.parliamentarian}
          onChange={(e) => setParliamentarian(e.target.value)}
        />
      </Field>
    ),
    currentAmount: (
      <Field label="Valor atual" htmlFor="f-currentAmount" error={errors.currentAmount} hint="Planilha: VALOR ATUAL">
        <MoneyInput id="f-currentAmount" value={currentAmount} invalid={!!errors.currentAmount} onChange={setCurrentAmount} />
      </Field>
    ),
    sector: (
      <Field label="Setor responsável" htmlFor="f-sector" error={errors.sectorId}>
        <Select id="f-sector" value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
          <option value="">Sem setor</option>
          {sectors.data
            ?.filter((s) => s.isActive || s.id === sectorId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isActive ? '' : ' (inativo)'}
              </option>
            ))}
        </Select>
      </Field>
    ),
    responsible: (
      <Field
        label="Técnica responsável"
        htmlFor="f-responsibleName"
        error={errors.responsibleName ?? errors.responsibleUserId}
        hint={
          responsibleUserId ? (
            <span className="inline-flex items-center gap-1.5">
              <UserCheck className="size-3.5 text-brand-600" />
              Vinculada à usuária <strong className="text-ink-700">{linkedName ?? 'do sistema'}</strong>
              <button type="button" className="text-ink-400 hover:text-red-600" onClick={() => setResponsibleUserId('')} title="Desvincular">
                <X className="size-3.5" />
              </button>
            </span>
          ) : (
            'Planilha: TÉCNICA RESPONSÁVEL. Vincule a uma usuária para aparecer em “minhas emendas”.'
          )
        }
      >
        <div className="flex gap-2">
          <Input
            id="f-responsibleName"
            maxLength={255}
            value={responsibleName}
            placeholder="Nome da técnica"
            onChange={(e) => {
              setResponsibleName(e.target.value)
              // nome digitado à mão deixa de valer como vínculo com a usuária
              if (responsibleUserId) setResponsibleUserId('')
            }}
          />
          {user && responsibleUserId !== user.id && (
            <Button type="button" variant="secondary" className="shrink-0" onClick={() => assignTo(user.id, user.name)}>
              Atribuir a mim
            </Button>
          )}
        </div>
        {isAdmin && (
          <Select
            aria-label="Vincular a uma usuária"
            className="mt-2"
            value={responsibleUserId}
            onChange={(e) => assignTo(e.target.value, users.data?.find((u) => u.id === e.target.value)?.name)}
          >
            <option value="">Vincular a uma usuária…</option>
            {users.data
              ?.filter((u) => u.isActive || u.id === responsibleUserId)
              .sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </Select>
        )}
      </Field>
    ),
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Emendas', to: '/emendas' },
          ...(isEdit && existing.data ? [{ label: amendmentTitle(existing.data), to: `/emendas/${id}` }] : []),
          { label: isEdit ? 'Editar' : 'Nova emenda' },
        ]}
        title={isEdit ? 'Editar emenda' : 'Nova emenda'}
        description="Os campos seguem as colunas da planilha de emendas. Só ano e parlamentar são obrigatórios."
      />

      <form onSubmit={submit} className="space-y-5 pb-24">
        {Object.keys(errors).length > 0 && (
          <Alert tone="danger" title="Revise os campos destacados" />
        )}

        {SHEET_SECTIONS.map((section) => (
          <section key={section.id} className="card">
            <header className="border-b border-ink-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-ink-900">{section.title}</h2>
              {section.description && <p className="mt-0.5 text-xs text-ink-500">{section.description}</p>}
            </header>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {(section.special ?? []).map((k) => (
                <div key={k} className={clsx(k === 'responsible' && 'sm:col-span-2', k === 'parliamentarian' && 'lg:col-span-2')}>
                  {specials[k]}
                </div>
              ))}
              {section.fields.map((f) => (
                <SheetInput key={f.key} field={f} value={sheet[f.key] ?? ''} error={errors[f.key]} onChange={(v) => setField(f.key, v)} />
              ))}
            </div>
          </section>
        ))}

        {isEdit && (
          <section className="card p-5">
            <Field label="Comentário da alteração" htmlFor="f-comment" hint="Opcional. Aparece na linha do tempo junto com os campos alterados.">
              <Textarea id="f-comment" className="min-h-16" maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
          </section>
        )}

        {/* sugestões com os valores já usados */}
        <datalist id="dl-parliamentarians">
          {options.data?.parliamentarians.map((v) => <option key={v} value={v} />)}
        </datalist>
        {Object.entries(SUGGESTIONS).map(([key, opt]) => (
          <datalist key={key} id={`dl-${key}`}>
            {(options.data?.[opt!] as string[] | undefined)?.map((v) => <option key={v} value={v} />)}
          </datalist>
        ))}

        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-ink-200 bg-surface/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/emendas/${id}` : '/emendas')}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            {isEdit ? 'Salvar alterações' : 'Cadastrar emenda'}
          </Button>
        </div>
      </form>
    </>
  )
}

function SheetInput({ field: f, value, error, onChange }: { field: SheetField; value: string; error?: string; onChange: (v: string) => void }) {
  const id = `f-${f.key}`
  return (
    <Field label={f.label} htmlFor={id} error={error} hint={`Planilha: ${f.sheet}`} className={clsx(f.wide && 'sm:col-span-2 lg:col-span-3')}>
      {f.kind === 'textarea' ? (
        <Textarea id={id} className="min-h-20" maxLength={f.max} value={value} invalid={!!error} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          id={id}
          type={f.kind === 'date' ? 'date' : 'text'}
          maxLength={f.max}
          list={SUGGESTIONS[f.key] ? `dl-${f.key}` : undefined}
          value={value}
          invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}
