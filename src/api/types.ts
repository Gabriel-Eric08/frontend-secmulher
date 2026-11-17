/**
 * Tipos espelhando os DTOs da API OmniBase (ver backend.md).
 * No front da Secretaria, "Client" do backend = "Mulher" atendida.
 */

export type UUID = string
/** AAAA-MM-DD */
export type ISODate = string
/** ISO-8601 com data e hora */
export type ISODateTime = string

// ---------------------------------------------------------------- Auth / usuários

export interface User {
  id: UUID
  name: string
  email: string
  isGlobalAdmin: boolean
  isActive: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  tokenType: 'Bearer'
  expiresAt: ISODateTime
  user: User
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface UserRequest {
  name: string
  email: string
  /** Obrigatório na criação; no PUT, se omitido, mantém a atual */
  password?: string
  isGlobalAdmin: boolean
  isActive: boolean
}

// ---------------------------------------------------------------- Acesso / permissões

export type EntityType = 'native' | 'dynamic'
export type ConfidentialityLevel = 'INTERNAL' | 'RESTRICTED' | 'CONFIDENTIAL'

export interface AllowedColumns {
  /** Sem a chave = todas legíveis */
  read?: string[]
  /** Sem a chave = todas graváveis */
  write?: string[]
}

export interface CategoryAccess {
  categoryId: UUID
  categoryName: string
  entityType: EntityType
  tableReference: string
  canRead: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  allowedColumns: AllowedColumns | null
  maxConfidentiality: ConfidentialityLevel
  /** Tipos de registro manual que o usuário pode registrar nesta categoria */
  activityTypes?: ActivityTypeSummary[]
}

export interface MeResponse {
  user: User
  access: CategoryAccess[]
}

export interface Permission {
  id: UUID
  userId: UUID
  categoryId: UUID
  canRead: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  allowedColumns: AllowedColumns | null
  maxConfidentiality: ConfidentialityLevel
  /** Keys dos tipos de registro liberados; null = todos */
  allowedActivityTypes: string[] | null
  createdAt: ISODateTime
}

export type PermissionRequest = Omit<Permission, 'id' | 'createdAt' | 'allowedActivityTypes'> & {
  /** [] remove a restrição (todos os tipos) */
  allowedActivityTypes: string[]
}

// ---------------------------------------------------------------- Categorias e campos

export interface Category {
  id: UUID
  name: string
  entityType: EntityType
  tableReference: string
  isActive: boolean
  createdAt: ISODateTime
}

export type CategoryRequest = Pick<Category, 'name' | 'entityType' | 'tableReference' | 'isActive'>

export type FieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'LIST' | 'DATE'

export type FilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'IN'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'BETWEEN'
  | 'IS_EMPTY'
  | 'NOT_EMPTY'

export interface CategoryField {
  id: UUID
  categoryId: UUID
  key: string
  label: string
  fieldType: FieldType
  isRequired: boolean
  options: string[] | null
  position: number
  filterOperators: FilterOperator[]
  createdAt?: ISODateTime
}

export interface CategoryFieldRequest {
  key: string
  label: string
  fieldType: FieldType
  isRequired: boolean
  options?: string[] | null
  position: number
}

// ---------------------------------------------------------------- Mulheres (clients)

export interface Mulher {
  id: UUID
  nome: string | null
  dataNascimento: ISODate | null
  telefone: string | null
  sobRisco: boolean | null
  createdBy: UUID | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
  /** Colunas (nomes snake_case) que o usuário não pode ler */
  hiddenFields: string[]
}

export interface MulherRequest {
  nome: string
  dataNascimento?: ISODate | null
  telefone?: string | null
  sobRisco?: boolean
}

// ---------------------------------------------------------------- Entidades dinâmicas

export type CustomFieldValue = string | number | boolean | null
export type CustomFields = Record<string, CustomFieldValue>

export interface DynamicEntity {
  id: UUID
  categoryId: UUID
  customFields: CustomFields
  createdBy: UUID | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
  hiddenFields: string[]
}

export interface DynamicEntityRequest {
  categoryId: UUID
  customFields: CustomFields
}

export interface SearchFilter {
  field: string
  operator: FilterOperator
  value?: unknown
}

export interface SearchRequest {
  categoryId: UUID
  filters?: SearchFilter[]
  sort?: { field: string; direction?: 'asc' | 'desc' }
  fields?: Record<string, unknown>
}

// ---------------------------------------------------------------- Linha do tempo / documentos

/** Segmento de rota compartilhado: /clients/{id}/... ou /dynamic-entities/{id}/... */
export type RecordKind = 'clients' | 'dynamic-entities'

/** Tipos manuais antigos (enum fixo): ainda aparecem em registros não migrados. */
export type LegacyManualType = 'TRIAGE' | 'SERVICE' | 'FOLLOW_UP' | 'NOTE'
export type ManualActivityType = 'MANUAL' | LegacyManualType
export type AutoActivityType =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'FILE_UPLOADED'
  | 'FILE_UPDATED'
  | 'FILE_REMOVED'
  | 'FILE_DOWNLOADED'
export type ActivityType = ManualActivityType | AutoActivityType

export interface ActivityChange {
  antigo: unknown
  novo: unknown
}

/** Valor de `entityType` no ledger e nos arquivos (nome da tabela). */
export type ActivityEntityType = 'clients' | 'dynamic_entities'

/** ActivityResponse */
export interface Activity {
  id: UUID
  entityType: ActivityEntityType
  entityId: UUID
  userId: UUID | null
  userName: string | null
  actionType: ActivityType
  /** Tipo do registro manual (label gravado no momento do registro); null nos automáticos */
  activityType: ActivityTypeSummary | null
  description: string | null
  /** Em UPDATED: {"campo": {"antigo": …, "novo": …}} */
  changes: Record<string, ActivityChange | unknown> | null
  responsibleEmployee: string | null
  occurredAt: ISODateTime | null
  createdAt: ISODateTime
  redacted: boolean
}

// ---------------------------------------------------------------- Tipos de registro (por categoria)

export interface ActivityTypeSummary {
  id: UUID
  key: string
  label: string
  color: string | null
}

export interface CategoryActivityType extends ActivityTypeSummary {
  categoryId: UUID
  description: string | null
  position: number
  isActive: boolean
  createdAt: ISODateTime
}

export interface ActivityTypeRequest {
  key: string
  label: string
  description?: string | null
  color?: string | null
  position: number
  isActive: boolean
}

export interface ActivityRequest {
  activityTypeId: UUID
  description: string
  responsibleEmployee?: string
  occurredAt?: string
}

/** Metadados de documento (FileResponse). */
export interface FileMeta {
  id: UUID
  entityType: ActivityEntityType
  entityId: UUID
  uploadedBy: UUID | null
  originalName: string
  contentType: string | null
  fileSizeBytes: number | null
  confidentialityLevel: ConfidentialityLevel
  uploadedAt: ISODateTime
}

/** RecordOverviewDto */
export interface Overview<T> {
  recordType: string
  record: T
  activities: Activity[]
  files: FileMeta[]
}

// ---------------------------------------------------------------- Erros (RFC 9457)

export interface ProblemDetails {
  title?: string
  status: number
  detail?: string
  instance?: string
  errors?: Record<string, string>
}
