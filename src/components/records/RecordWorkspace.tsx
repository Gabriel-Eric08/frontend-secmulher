import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Activity, FileMeta, RecordKind, UUID } from '@/api'
import type { Access } from '@/auth/access'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Layout'
import { Timeline } from './Timeline'
import { FilesPanel } from './FilesPanel'
import { ActivityFormModal } from './ActivityFormModal'

/** Abas de linha do tempo e documentos da visão 360° de um registro. */
export function RecordWorkspace({
  kind,
  recordId,
  activities,
  files,
  access,
  labelFor,
}: {
  kind: RecordKind
  recordId: UUID
  activities: Activity[]
  files: FileMeta[]
  access: Access
  labelFor?: (key: string) => string
}) {
  const [tab, setTab] = useState<'timeline' | 'files'>('timeline')
  const [adding, setAdding] = useState(false)

  return (
    <section className="card">
      <div className="flex items-end justify-between gap-3 px-5 pt-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'timeline', label: 'Linha do tempo', count: activities.length },
            { value: 'files', label: 'Documentos', count: files.length },
          ]}
        />
        {tab === 'timeline' && access.canUpdate && (
          <Button size="sm" className="mb-2" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            Novo registro
          </Button>
        )}
      </div>
      <div className="border-t border-ink-200">
        {tab === 'timeline' ? (
          <div className="p-5">
            <Timeline activities={activities} labelFor={labelFor} />
          </div>
        ) : (
          <FilesPanel files={files} kind={kind} recordId={recordId} access={access} />
        )}
      </div>
      <ActivityFormModal open={adding} onClose={() => setAdding(false)} kind={kind} recordId={recordId} />
    </section>
  )
}
