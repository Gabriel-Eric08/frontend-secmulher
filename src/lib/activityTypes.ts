import type { CSSProperties } from 'react'
import {
  Brain,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  House,
  MessageSquareText,
  Phone,
  Repeat,
  Scale,
  Send,
  Stethoscope,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'
import type { Activity, ActivityType, ActivityTypeSummary, LegacyManualType } from '@/api'
import { ACTIVITY_LABEL } from './format'

/** Cor usada quando o tipo não define uma. */
export const DEFAULT_TYPE_COLOR = '#5b2a86'

/** Paleta sugerida no cadastro de tipos (contraste suficiente com texto branco). */
export const TYPE_COLOR_PRESETS = [
  '#5b2a86', // roxo institucional
  '#9a3f8f', // magenta
  '#0e7490', // petróleo
  '#047857', // verde
  '#b45309', // âmbar
  '#b91c1c', // vermelho
  '#1d4ed8', // azul
  '#4b5563', // cinza
]

const LEGACY: Record<LegacyManualType, { key: string; color: string }> = {
  TRIAGE: { key: 'triagem', color: '#5b2a86' },
  SERVICE: { key: 'atendimento', color: '#047857' },
  FOLLOW_UP: { key: 'acompanhamento', color: '#0e7490' },
  NOTE: { key: 'anotacao', color: '#4b5563' },
}

const ICON_BY_KEY: Record<string, LucideIcon> = {
  triagem: ClipboardList,
  atendimento: HeartHandshake,
  acompanhamento: Repeat,
  anotacao: StickyNote,
}

const MANUAL_ACTIONS = new Set<ActivityType>(['MANUAL', 'TRIAGE', 'SERVICE', 'FOLLOW_UP', 'NOTE'])

export const isManualActivity = (a: Pick<Activity, 'actionType'>) => MANUAL_ACTIONS.has(a.actionType)

/** Tipo efetivo de um registro manual, inclusive dos antigos (enum fixo) não migrados. */
export function activityTypeOf(a: Activity): ActivityTypeSummary | null {
  if (a.activityType) return a.activityType
  const legacy = LEGACY[a.actionType as LegacyManualType]
  if (!legacy) return null
  return { id: `legacy-${a.actionType}`, key: legacy.key, label: ACTIVITY_LABEL[a.actionType], color: legacy.color }
}

/** Ícone por trecho da key, para tipos criados pela administração. */
const ICON_BY_FRAGMENT: [RegExp, LucideIcon][] = [
  [/psic/, Brain],
  [/jurid|legal|advoc/, Scale],
  [/visita|domicil/, House],
  [/curso|matricula|aula|certificad|capacita/, GraduationCap],
  [/presenca|frequencia/, CalendarCheck],
  [/encaminh/, Send],
  [/saude|medic/, Stethoscope],
  [/telefon|ligacao|contato/, Phone],
]

export function typeIcon(key: string | undefined): LucideIcon {
  if (!key) return MessageSquareText
  return ICON_BY_KEY[key] ?? ICON_BY_FRAGMENT.find(([re]) => re.test(key))?.[1] ?? MessageSquareText
}

export function typeColor(t: Pick<ActivityTypeSummary, 'color'> | null | undefined): string {
  return t?.color || DEFAULT_TYPE_COLOR
}

/** Estilos derivados da cor do tipo: ícone sólido, etiqueta clara e acento lateral. */
export function typeStyles(t: Pick<ActivityTypeSummary, 'color'> | null | undefined) {
  const c = typeColor(t)
  // #rgb → #rrggbb, para poder acrescentar transparência
  const hex = c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c.slice(0, 7)
  return {
    icon: { backgroundColor: hex, color: '#fff' } satisfies CSSProperties,
    chip: { backgroundColor: `${hex}14`, color: hex, boxShadow: `inset 0 0 0 1px ${hex}40` } satisfies CSSProperties,
    accent: { borderLeftColor: hex } satisfies CSSProperties,
    ring: { borderColor: hex, boxShadow: `0 0 0 1px ${hex}`, backgroundColor: `${hex}0d` } satisfies CSSProperties,
  }
}

/** Rótulo de qualquer atividade (manual: nome do tipo; automática: rótulo fixo). */
export function activityLabel(a: Activity): string {
  return activityTypeOf(a)?.label ?? ACTIVITY_LABEL[a.actionType] ?? a.actionType
}
