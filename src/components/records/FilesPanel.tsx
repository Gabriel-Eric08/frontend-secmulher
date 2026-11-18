import { useRef, useState, type FormEvent } from 'react'
import { Download, FileText, MoreHorizontal, Trash2, Upload } from 'lucide-react'
import { fileDisplayName, type ConfidentialityLevel, type FileMeta, type RecordKind, type UUID } from '@/api'
import type { Access } from '@/auth/access'
import { useFileActions, useUploadFile } from '@/queries/records'
import { CONFIDENTIALITY_HINT, CONFIDENTIALITY_LABEL, formatBytes, formatDateTime } from '@/lib/format'
import { ConfidentialityBadge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/States'
import { useConfirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'

const MAX_BYTES = 20 * 1024 * 1024

function UploadModal({
  open,
  onClose,
  kind,
  recordId,
  access,
}: {
  open: boolean
  onClose: () => void
  kind: RecordKind
  recordId: UUID
  access: Access
}) {
  const toast = useToast()
  const upload = useUploadFile(kind, recordId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const defaultLevel: ConfidentialityLevel = access.canAccessLevel('RESTRICTED') ? 'RESTRICTED' : 'INTERNAL'
  const [level, setLevel] = useState<ConfidentialityLevel>(defaultLevel)
  const [error, setError] = useState('')

  const close = () => {
    setFile(null)
    setError('')
    setLevel(defaultLevel)
    onClose()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return setError('Selecione um arquivo.')
    if (file.size > MAX_BYTES) return setError('O arquivo excede o limite de 20 MB.')
    try {
      await upload.mutateAsync({ file, level })
      toast.success('Documento anexado.')
      close()
    } catch (err) {
      toast.error(err)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Anexar documento"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" form="upload-form" loading={upload.isPending} icon={<Upload className="size-4" />}>
            Enviar
          </Button>
        </>
      }
    >
      <form id="upload-form" onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Arquivo</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-ink-300 px-4 py-8 text-sm text-ink-500 hover:border-brand-400 hover:bg-brand-50/50"
          >
            <Upload className="size-5 text-brand-600" />
            {file ? (
              <span className="text-ink-800">
                {file.name} <span className="text-ink-500">({formatBytes(file.size)})</span>
              </span>
            ) : (
              <span>Clique para selecionar · até 20 MB</span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setError('')
            }}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <Field label="Nível de sigilo" htmlFor="upload-level" hint={CONFIDENTIALITY_HINT[level]}>
          <Select id="upload-level" value={level} onChange={(e) => setLevel(e.target.value as ConfidentialityLevel)}>
            {access.allowedLevels.map((l) => (
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

function FileRow({ file, kind, recordId, access }: { file: FileMeta; kind: RecordKind; recordId: UUID; access: Access }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { download, remove, setConfidentiality } = useFileActions(kind, recordId)
  const [menu, setMenu] = useState(false)
  const name = fileDisplayName(file)

  const onDownload = () =>
    download.mutate({ fileId: file.id, name }, { onError: (e) => toast.error(e) })

  const onRemove = async () => {
    setMenu(false)
    const ok = await confirm({
      title: 'Remover documento',
      message: <>O documento <strong>{name}</strong> será removido. A remoção fica registrada na linha do tempo.</>,
      confirmLabel: 'Remover',
      danger: true,
    })
    if (!ok) return
    remove.mutate(file.id, {
      onSuccess: () => toast.success('Documento removido.'),
      onError: (e) => toast.error(e),
    })
  }

  const onLevel = (level: ConfidentialityLevel) => {
    setMenu(false)
    if (level === file.confidentialityLevel) return
    setConfidentiality.mutate(
      { fileId: file.id, level },
      { onSuccess: () => toast.success('Nível de sigilo atualizado.'), onError: (e) => toast.error(e) },
    )
  }

  const canManage = access.canUpdate || access.canDelete

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
        <FileText className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-800" title={name}>
          {name}
        </p>
        <p className="text-xs text-ink-500">
          {[formatDateTime(file.uploadedAt), formatBytes(file.fileSizeBytes ?? undefined)].filter((x) => x && x !== '—').join(' · ')}
        </p>
      </div>
      <ConfidentialityBadge level={file.confidentialityLevel} />
      <IconButton label="Baixar" onClick={onDownload} disabled={download.isPending}>
        <Download className="size-4" />
      </IconButton>
      {canManage && (
        <div className="relative">
          <IconButton label="Mais ações" onClick={() => setMenu((v) => !v)}>
            <MoreHorizontal className="size-4" />
          </IconButton>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-ink-200 bg-surface py-1 text-sm shadow-lg">
                {access.canUpdate && (
                  <>
                    <p className="px-3 py-1.5 text-xs font-medium text-ink-500">Alterar sigilo</p>
                    {access.allowedLevels.map((l) => (
                      <button
                        key={l}
                        onClick={() => onLevel(l)}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-ink-50"
                      >
                        {CONFIDENTIALITY_LABEL[l]}
                        {l === file.confidentialityLevel && <span className="text-xs text-brand-700">atual</span>}
                      </button>
                    ))}
                  </>
                )}
                {access.canDelete && (
                  <button
                    onClick={onRemove}
                    className="mt-1 flex w-full items-center gap-2 border-t border-ink-100 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="size-4" /> Remover
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  )
}

export function FilesPanel({
  files,
  kind,
  recordId,
  access,
}: {
  files: FileMeta[]
  kind: RecordKind
  recordId: UUID
  access: Access
}) {
  const [uploading, setUploading] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
        <p className="text-xs text-ink-500">
          Você visualiza documentos até o nível <strong>{CONFIDENTIALITY_LABEL[access.maxConfidentiality]}</strong>.
        </p>
        {access.canUpdate && (
          <Button size="sm" variant="secondary" icon={<Upload className="size-4" />} onClick={() => setUploading(true)}>
            Anexar
          </Button>
        )}
      </div>
      {files.length === 0 ? (
        <EmptyState title="Nenhum documento" description="Documentos anexados ao cadastro aparecerão aqui." />
      ) : (
        <ul className="divide-y divide-ink-100">
          {files.map((f) => (
            <FileRow key={f.id} file={f} kind={kind} recordId={recordId} access={access} />
          ))}
        </ul>
      )}
      <UploadModal open={uploading} onClose={() => setUploading(false)} kind={kind} recordId={recordId} access={access} />
    </div>
  )
}
