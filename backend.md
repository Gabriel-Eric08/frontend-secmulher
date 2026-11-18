# Dicionário da aplicação OmniBase

Referência de **tudo o que existe na aplicação**: tabelas e colunas, valores de domínio (enums), rotas da API e termos do negócio. O [README](README.md) explica como usar; este arquivo descreve **o que cada coisa é**.

> **Regra do projeto:** toda mudança em tabela, coluna, enum, rota ou regra de negócio atualiza este dicionário na mesma entrega (ver [`CLAUDE.md`](../CLAUDE.md)).

## Sumário

- [Convenções](#convenções)
- [Módulos](#módulos)
- [Tabelas do core](#tabelas-do-core)
- [Tabelas do módulo financeiro](#tabelas-do-módulo-financeiro)
- [Valores de domínio (enums)](#valores-de-domínio-enums)
- [Rotas da API](#rotas-da-api)
- [Glossário](#glossário)

---

## Convenções

| Item | Convenção |
|---|---|
| Schema | Mantido em `src/main/resources/db/init.sql`, idempotente (pode rodar várias vezes). O Hibernate só valida (`ddl-auto=validate`). |
| Chave primária | `id UUID` gerado por `gen_random_uuid()` em todas as tabelas. |
| Datas e horas | `TIMESTAMP WITH TIME ZONE` para momentos (`created_at`, `updated_at`, `occurred_at`); `DATE` para datas de negócio (ex.: `operation_date`). |
| Valores monetários | `NUMERIC(15,2)`: até 13 dígitos inteiros e 2 casas decimais. Na API, números JSON (ex.: `1500.50`). |
| Datas na API | `AAAA-MM-DD` (ISO). |
| Códigos únicos | Códigos de ação/subação e números de empenho são únicos **sem diferenciar maiúsculas** (índice em `LOWER(...)`). |
| Imutabilidade | Linha do tempo (`activities_ledger`) e histórico financeiro (`finance_operations`, `finance_entries`) nunca são editados nem apagados. |
| Autenticação | Todas as rotas exigem `Authorization: Bearer <token>`, exceto `POST /auth/login`. |
| Erros | Formato `ProblemDetail` (`status`, `title`, `detail`, `errors`). 400 validação, 401 sem token, 403 sem permissão, 404 não encontrado, 409 conflito, 422 regra de negócio. |

---

## Módulos

| Módulo | Pacote | Conteúdo |
|---|---|---|
| core | `com.secmulher.modules.core` | Usuários, autenticação, categorias, permissões, clientes, entidades dinâmicas, linha do tempo, documentos. |
| finance | `com.secmulher.modules.finance` | Ações, subações, operações orçamentárias (Métodos A/B/C) e execução da despesa (empenho, liquidação, pagamento). |

---

## Tabelas do core

### `users` — usuários do sistema

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `name` | VARCHAR(255) | sim | Nome exibido. |
| `email` | VARCHAR(255) | sim | E-mail de login (único). |
| `password_hash` | VARCHAR(255) | sim | Senha em BCrypt. Nunca sai na API. |
| `is_global_admin` | BOOLEAN | não | Administrador global: acesso total, sem depender de permissões. Padrão `false`. |
| `is_active` | BOOLEAN | não | Usuário inativo não faz login e perde o acesso na hora, mesmo com token válido. Padrão `true`. |
| `created_at` / `updated_at` | TIMESTAMPTZ | não | Criação e última alteração. |

### `categories` — lista oficial do que existe no sistema

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `name` | VARCHAR(255) | sim | Nome (único). Ex.: "Mulheres", "Cursos", "Financeiro". |
| `entity_type` | VARCHAR(50) | sim | `native` (tabela própria) ou `dynamic` (registros em `dynamic_entities`). |
| `table_reference` | VARCHAR(100) | sim | Tabela dos registros. Nativas: `clients` (clientes) ou `finance_actions` (módulo financeiro). Dinâmicas: `dynamic_entities`. |
| `is_active` | BOOLEAN | não | Categoria desativada. Padrão `true`. |
| `created_at` | TIMESTAMPTZ | não | Criação. |

### `permissions` — matriz usuário × categoria

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `user_id` | UUID → `users` | sim | Usuário. Apagado em cascata com o usuário. |
| `category_id` | UUID → `categories` | sim | Categoria. Apagado em cascata com a categoria. |
| `can_read` / `can_create` / `can_update` / `can_delete` | BOOLEAN | não | O que o usuário pode fazer na categoria. Padrão `false`. |
| `allowed_columns` | JSONB | não | Colunas visíveis/editáveis: `{"read": [...], "write": [...]}`. Sem a chave, todas as colunas. |
| `max_confidentiality` | VARCHAR(20) | sim | Nível máximo de sigilo de documento acessível (`ConfidentialityLevel`). Padrão `INTERNAL`. |
| `allowed_activity_types` | JSONB | não | Keys dos tipos de registro manual que o usuário pode lançar; `NULL` = todos. |
| `created_at` | TIMESTAMPTZ | não | Criação. |

Restrição: `UNIQUE(user_id, category_id)`.

### `clients` — pessoas atendidas (categoria nativa)

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `nome` | VARCHAR(255) | sim | Nome da atendida. |
| `data_nascimento` | DATE | não | Data de nascimento (não pode ser futura). |
| `telefone` | VARCHAR(50) | não | Telefone de contato. |
| `sob_risco` | BOOLEAN | não | Indica situação de risco. Padrão `false`. |
| `created_by` | UUID → `users` | não | Quem cadastrou (`NULL` se o usuário foi apagado). |
| `created_at` / `updated_at` | TIMESTAMPTZ | não | Criação e última alteração. |

### `dynamic_entities` — registros das categorias dinâmicas

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `category_id` | UUID → `categories` | sim | Categoria do registro (`RESTRICT`: a categoria não sai enquanto houver registros). |
| `custom_fields` | JSONB | sim | Valores dos campos, pela `field_key` definida em `category_fields`. Índice GIN para buscas. |
| `created_by` | UUID → `users` | não | Quem cadastrou. |
| `created_at` / `updated_at` | TIMESTAMPTZ | não | Criação e última alteração. |

### `category_fields` — campos (formulário) de cada categoria dinâmica

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `category_id` | UUID → `categories` | sim | Categoria dona do campo (cascata). |
| `field_key` | VARCHAR(100) | sim | Chave usada no JSONB (ex.: `bairro`). Única por categoria. |
| `label` | VARCHAR(255) | sim | Rótulo exibido (ex.: "Bairro"). |
| `field_type` | VARCHAR(20) | sim | Tipo do valor (`FieldType`). |
| `is_required` | BOOLEAN | não | Campo obrigatório. Padrão `false`. |
| `options` | JSONB | não | Opções válidas quando `field_type = LIST`. |
| `position` | INTEGER | não | Ordem de exibição. |
| `created_at` | TIMESTAMPTZ | não | Criação. |

### `activities_ledger` — linha do tempo e auditoria (imutável)

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `entity_type` | VARCHAR(100) | sim | Tabela do registro (`clients` ou `dynamic_entities`). |
| `entity_id` | UUID | sim | Registro dentro da tabela (sem FK: o histórico sobrevive à exclusão do registro). |
| `user_id` | UUID → `users` | não | Quem fez a ação no sistema. |
| `action_type` | VARCHAR(50) | sim | Tipo do evento (`ActivityType`). |
| `activity_type_id` | UUID → `activity_types` | não | Tipo configurável, quando `action_type = MANUAL`. |
| `activity_type_label` | VARCHAR(255) | não | Nome do tipo **no momento do registro** (renomear o tipo não altera o histórico). |
| `description` | TEXT | não | Texto livre. |
| `changes` | JSONB | não | O que mudou: `{"campo": {"antigo": ..., "novo": ...}}`. |
| `responsible_employee` | VARCHAR(255) | não | Funcionária que realizou o atendimento (pode não ser usuária do sistema). |
| `occurred_at` | TIMESTAMPTZ | sim | Quando a atividade aconteceu (pode ser anterior ao registro). |
| `created_at` | TIMESTAMPTZ | não | Quando foi registrada. |

### `activity_types` — tipos de registro manual por categoria

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `category_id` | UUID → `categories` | sim | Categoria (cascata). |
| `key` | VARCHAR(100) | sim | Identificador estável (`^[a-z][a-z0-9_]*$`), único na categoria e imutável. |
| `label` | VARCHAR(255) | sim | Nome exibido. |
| `description` | TEXT | não | Descrição. |
| `color` | VARCHAR(20) | não | Cor de exibição (ex.: `#5b2a86`). |
| `position` | INTEGER | não | Ordem. |
| `is_active` | BOOLEAN | não | Tipo desativado não aparece para lançamento. |
| `created_at` | TIMESTAMPTZ | não | Criação. |

### `files` — documentos e anexos

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `entity_type` / `entity_id` | VARCHAR(100) / UUID | sim | Registro dono do documento (mesmo padrão da linha do tempo). |
| `uploaded_by` | UUID → `users` | não | Quem enviou. |
| `original_name` | VARCHAR(255) | sim | Nome original do arquivo (só metadado). |
| `storage_path` | VARCHAR(500) | sim | Caminho no armazenamento (nome UUID dentro de `STORAGE_PATH`). |
| `file_size_bytes` | BIGINT | não | Tamanho. |
| `content_type` | VARCHAR(255) | não | Tipo MIME. |
| `confidentiality_level` | VARCHAR(20) | sim | Sigilo (`ConfidentialityLevel`). Padrão `RESTRICTED`. |
| `uploaded_at` | TIMESTAMPTZ | não | Envio. |

---

## Tabelas do módulo financeiro

Relações:

```
finance_actions 1─N finance_sub_actions 1─N finance_commitments
       │                    │                     │
       └──────── finance_entries N─1 finance_operations ┘ (commitment_id)
```

### `finance_actions` — ações orçamentárias

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `code` | VARCHAR(50) | sim | Código da ação, único (sem diferenciar maiúsculas). |
| `name` | VARCHAR(255) | sim | Nome. |
| `description` | TEXT | não | Descrição. |
| `total_amount` | NUMERIC(15,2) | sim | **Valor total atual** da ação = soma dos lançamentos `BUDGET` sem subação. Nunca negativo. Só muda por operação. |
| `is_active` | BOOLEAN | sim | Inativa não recebe empenhos, transferências, TAC nem distribuição. |
| `created_by` | UUID → `users` | não | Quem cadastrou. |
| `created_at` / `updated_at` | TIMESTAMPTZ | não | Criação e última alteração. |

Derivados (não gravados): **distribuído** = soma de `balance` das subações; **saldo a distribuir** = `total_amount` − distribuído; **empenhado/liquidado/pago** = soma das subações; **disponível** = `total_amount` − empenhado.

### `finance_sub_actions` — subações (fatias da ação)

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `action_id` | UUID → `finance_actions` | sim | Ação dona (cascata ao excluir a ação, o que só acontece sem movimentação). |
| `code` | VARCHAR(50) | sim | Código, único **em todo o sistema**. |
| `name` | VARCHAR(255) | sim | Nome. |
| `description` | TEXT | não | Descrição. |
| `balance` | NUMERIC(15,2) | sim | **Dotação atual** = soma dos lançamentos `BUDGET` da subação. |
| `committed_amount` | NUMERIC(15,2) | sim | Empenhado líquido (empenhos − anulações). |
| `liquidated_amount` | NUMERIC(15,2) | sim | Liquidado. |
| `paid_amount` | NUMERIC(15,2) | sim | Pago. |
| `is_active` | BOOLEAN | sim | Inativa não recebe empenhos nem transferências; empenhos existentes continuam podendo ser liquidados, pagos e anulados. |
| `created_by` | UUID → `users` | não | Quem cadastrou. |
| `created_at` / `updated_at` | TIMESTAMPTZ | não | Criação e última alteração. |

Restrição `ck_finance_sub_actions_execution`: `0 <= paid_amount <= liquidated_amount <= committed_amount <= balance`. **Disponível** (derivado) = `balance` − `committed_amount`.

### `finance_operations` — operações (imutáveis)

Cada ação do usuário que movimenta valores gera uma linha aqui e um ou mais lançamentos em `finance_entries`.

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `number` | BIGSERIAL | sim | Número sequencial da operação (ordem de registro). |
| `method` | VARCHAR(40) | sim | Tipo da operação (`FinanceOperationMethod`). |
| `amount` | NUMERIC(15,2) | sim | Valor da operação (> 0). |
| `description` | TEXT | não | Justificativa/descrição. Nas operações de empenho, se vazia, recebe um texto padrão. |
| `commitment_id` | UUID → `finance_commitments` | não | Empenho, nas operações de empenho, anulação, liquidação e pagamento. |
| `performed_by` | UUID → `users` | não | Quem registrou. |
| `operation_date` | DATE | sim | **Data real** da operação (informada pelo usuário; padrão: dia do registro). Define os saldos em cada dia e a ordem dos históricos. Não pode ser futura. |
| `occurred_at` | TIMESTAMPTZ | sim | **Momento do registro** no sistema (na API: `registeredAt`). |

### `finance_entries` — lançamentos (imutáveis)

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `operation_id` | UUID → `finance_operations` | sim | Operação que gerou o lançamento. |
| `action_id` | UUID → `finance_actions` | sim | Ação afetada. |
| `sub_action_id` | UUID → `finance_sub_actions` | não | Subação afetada. `NULL` = lançamento no valor total da ação. |
| `kind` | VARCHAR(20) | sim | O que o lançamento altera (`FinanceEntryKind`). Lançamentos sem subação são sempre `BUDGET`. |
| `amount` | NUMERIC(15,2) | sim | Valor com sinal: positivo entra, negativo sai (≠ 0). |

Os campos de saldo gravados (`total_amount`, `balance`, `committed_amount`...) são sempre a soma destes lançamentos; somá-los até uma `operation_date` dá o valor naquele dia.

### `finance_commitments` — empenhos

| Coluna | Tipo | Obrig. | Descrição |
|---|---|---|---|
| `id` | UUID | sim | Identificador. |
| `number` | VARCHAR(50) | sim | Número da nota de empenho (ex.: `2026NE000123`), único. |
| `commitment_date` | DATE | sim | Data real do empenho (igual à `operation_date` da operação de empenho). |
| `sub_action_id` | UUID → `finance_sub_actions` | sim | Subação empenhada. |
| `action_id` | UUID → `finance_actions` | sim | Ação da subação (cópia para consultas). |
| `creditor` | VARCHAR(255) | sim | Favorecido (credor). |
| `description` | TEXT | não | Objeto do empenho. |
| `amount` | NUMERIC(15,2) | sim | Valor original empenhado (> 0, não muda). |
| `cancelled_amount` | NUMERIC(15,2) | sim | Total anulado. |
| `liquidated_amount` | NUMERIC(15,2) | sim | Total liquidado. |
| `paid_amount` | NUMERIC(15,2) | sim | Total pago. |
| `created_by` | UUID → `users` | não | Quem registrou. |
| `created_at` / `updated_at` | TIMESTAMPTZ | não | Criação e última alteração. |

Restrição `ck_finance_commitments_execution`: `paid_amount <= liquidated_amount <= amount − cancelled_amount`. Derivados: **empenhado** = `amount` − `cancelled_amount`; **a liquidar** = empenhado − liquidado; **a pagar** = liquidado − pago; **situação** (`CommitmentStatus`).

---

## Valores de domínio (enums)

### Core

| Enum | Valores | Onde |
|---|---|---|
| `ActivityType` | `MANUAL` (registro manual com tipo configurável), `CREATED`, `UPDATED`, `DELETED`, `FILE_UPLOADED`, `FILE_UPDATED`, `FILE_REMOVED`, `FILE_DOWNLOADED` | `activities_ledger.action_type` |
| `ConfidentialityLevel` | `INTERNAL` (interno) < `RESTRICTED` (restrito) < `CONFIDENTIAL` (sigiloso) | `files.confidentiality_level`, `permissions.max_confidentiality` |
| `FieldType` | `TEXT`, `NUMBER`, `DATE`, `BOOLEAN`, `LIST` | `category_fields.field_type` |
| `RecordType` | `CLIENT` (`/clients`, tabela `clients`), `DYNAMIC_ENTITY` (`/dynamic-entities`, tabela `dynamic_entities`) | Rotas de registro e polimorfismo |
| `FilterOperator` | `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `STARTS_WITH`, `IN`, `GT`, `GTE`, `LT`, `LTE`, `BETWEEN`, `IS_EMPTY`, `NOT_EMPTY` | `POST /dynamic-entities/search` |

### Financeiro

| Enum | Valor | Significado |
|---|---|---|
| `FinanceOperationMethod` | `OPENING` | Valor inicial informado ao criar a ação; entra como saldo a distribuir. |
| | `DISTRIBUTION` | Reparte o saldo a distribuir da ação entre as subações dela. |
| | `TRANSFER_BETWEEN_SUB_ACTIONS` | **Método A**: move disponível entre subações da mesma ação. |
| | `TRANSFER_BETWEEN_ACTIONS` | **Método B**: move disponível para a subação de outra ação (os totais das duas ações mudam). |
| | `TAC` | **Método C**: soma valor à ação; o não alocado fica a distribuir. |
| | `COMMITMENT` | Empenho. |
| | `COMMITMENT_CANCELLATION` | Anulação (parcial ou total) da parte não liquidada de um empenho. |
| | `LIQUIDATION` | Liquidação de um empenho. |
| | `PAYMENT` | Pagamento de um empenho (até o liquidado). |
| `FinanceEntryKind` | `BUDGET` | Dotação: valor total da ação (sem subação) ou dotação da subação. |
| | `COMMITTED` | Empenhado da subação (anulação lança negativo). |
| | `LIQUIDATED` | Liquidado da subação. |
| | `PAID` | Pago da subação. |
| `CommitmentStatus` (derivado) | `TO_LIQUIDATE` | Há valor a liquidar. |
| | `TO_PAY` | Tudo liquidado, há valor a pagar. |
| | `PAID` | Tudo liquidado e pago. |
| | `CANCELLED` | Anulado por inteiro, sem nada liquidado. |

---

## Rotas da API

Acesso: **público**, **autenticado**, **admin** (administrador global), ou a permissão na categoria (**leitura**, **criação**, **edição**, **exclusão**). No financeiro, a categoria é a nativa com `table_reference = 'finance_actions'`.

### Autenticação e usuários

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/auth/login` | público | Login com e-mail e senha; devolve o JWT. |
| `GET` | `/auth/me` | autenticado | Usuário logado e acesso efetivo por categoria. |
| `PUT` | `/auth/me/password` | autenticado | Troca a própria senha. |
| `GET` | `/users` | admin | Lista usuários. |
| `GET` | `/users/{id}` | admin ou o próprio | Busca usuário. |
| `GET` | `/users/{id}/activities` | admin ou o próprio | Ações realizadas pelo usuário (auditoria). |
| `POST` | `/users` | admin | Cria usuário. |
| `PUT` | `/users/{id}` | admin | Atualiza usuário. |
| `DELETE` | `/users/{id}` | admin | Exclui usuário. |

### Categorias, campos, tipos de registro e permissões

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/categories` | autenticado | Lista categorias (usuário comum vê só as que pode ler). |
| `GET` | `/categories/{id}` | leitura | Busca categoria. |
| `POST` | `/categories` | admin | Cria categoria (com os tipos de registro padrão). |
| `PUT` | `/categories/{id}` | admin | Atualiza categoria. |
| `DELETE` | `/categories/{id}` | admin | Exclui categoria (409 se houver registros ou tipos já usados). |
| `GET` | `/categories/{categoryId}/fields` | leitura | Lista campos da categoria dinâmica. |
| `POST` | `/categories/{categoryId}/fields` | admin | Cria campo. |
| `PUT` | `/categories/{categoryId}/fields/{fieldId}` | admin | Atualiza campo. |
| `DELETE` | `/categories/{categoryId}/fields/{fieldId}?purgeData=false` | admin | Remove campo (opcionalmente apaga os valores). |
| `GET` | `/categories/{categoryId}/activity-types?includeInactive=false` | leitura | Lista tipos de registro manual. |
| `POST` | `/categories/{categoryId}/activity-types` | admin | Cria tipo. |
| `PUT` | `/categories/{categoryId}/activity-types/{typeId}` | admin | Atualiza tipo. |
| `DELETE` | `/categories/{categoryId}/activity-types/{typeId}` | admin | Exclui tipo. |
| `GET` | `/permissions?userId=` | admin | Lista permissões. |
| `GET` | `/permissions/{id}` | admin | Busca permissão. |
| `POST` | `/permissions` | admin | Cria permissão. |
| `PUT` | `/permissions/{id}` | admin | Atualiza permissão. |
| `DELETE` | `/permissions/{id}` | admin | Remove permissão. |

### Clientes, entidades dinâmicas, linha do tempo e documentos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/clients` | leitura | Lista clientes. |
| `GET` | `/clients/{id}` | leitura | Busca cliente. |
| `POST` | `/clients` | criação | Cria cliente. |
| `PUT` | `/clients/{id}` | edição | Atualiza cliente. |
| `DELETE` | `/clients/{id}` | exclusão | Exclui cliente e documentos (histórico permanece). |
| `GET` | `/dynamic-entities?categoryId=` | leitura | Lista registros dinâmicos. |
| `GET` | `/dynamic-entities/{id}` | leitura | Busca registro. |
| `POST` | `/dynamic-entities/search` | leitura | Busca com filtros (`FilterOperator`). |
| `POST` | `/dynamic-entities` | criação | Cria registro. |
| `PUT` | `/dynamic-entities/{id}` | edição | Atualiza registro. |
| `DELETE` | `/dynamic-entities/{id}` | exclusão | Exclui registro e documentos (histórico permanece). |
| `GET` | `/{tipo}/{id}/overview` | leitura | Visão 360°: registro + linha do tempo + documentos. `{tipo}` = `clients` ou `dynamic-entities`. |
| `GET` | `/{tipo}/{id}/activities` | leitura | Linha do tempo do registro. |
| `POST` | `/{tipo}/{id}/activities` | edição | Registra atendimento manual. |
| `GET` | `/{tipo}/{id}/files` | leitura | Documentos do registro (só sigilo permitido). |
| `POST` | `/{tipo}/{id}/files` | edição | Envia documento (`multipart/form-data`). |
| `GET` | `/files/{id}` | leitura + sigilo | Metadados do documento. |
| `GET` | `/files/{id}/download` | leitura + sigilo | Baixa o arquivo. |
| `PATCH` | `/files/{id}` | edição + sigilo | Altera o nível de sigilo. |
| `DELETE` | `/files/{id}` | exclusão + sigilo | Remove o documento. |

### Financeiro

Em todas as rotas `?date=AAAA-MM-DD` mostra os valores no fim daquele dia (pela data real das operações). Em todas as operações, o corpo aceita `date` opcional (data real; padrão hoje; nunca futura).

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/finance/dashboard?date=` | leitura | Todas as ações com subações e totais gerais (total, distribuído, a distribuir, empenhado, liquidado, pago, disponível). |
| `GET` | `/finance/actions?date=` | leitura | Lista de ações (mesmo conteúdo do dashboard, sem totais gerais). |
| `GET` | `/finance/actions/{id}?date=` | leitura | Uma ação com subações. |
| `GET` | `/finance/actions/{id}/history?from=&to=` | leitura | Operações da ação (mais recente primeiro) com variação e valor acumulado de total, a distribuir, empenhado, liquidado, pago e disponível. |
| `POST` | `/finance/actions` | criação | Cria ação: `code`, `name`, `description`, `initialAmount`, `initialDate`. |
| `PUT` | `/finance/actions/{id}` | edição | Altera `code`, `name`, `description`, `isActive`. |
| `DELETE` | `/finance/actions/{id}` | exclusão | Exclui ação sem movimentação (409 caso contrário). |
| `POST` | `/finance/actions/{id}/sub-actions` | criação | Cria subação (dotação zero): `code`, `name`, `description`. |
| `GET` | `/finance/sub-actions/{id}?date=` | leitura | Uma subação. |
| `GET` | `/finance/sub-actions/{id}/history?from=&to=` | leitura | Operações da subação com variação e acumulado de dotação, empenhado, liquidado, pago e disponível. |
| `PUT` | `/finance/sub-actions/{id}` | edição | Altera `code`, `name`, `description`, `isActive`. |
| `DELETE` | `/finance/sub-actions/{id}` | exclusão | Exclui subação sem movimentação (409 caso contrário). |
| `GET` | `/finance/operations?actionId=&subActionId=&commitmentId=&method=&from=&to=` | leitura | Histórico geral de operações (filtros pela data real). |
| `GET` | `/finance/operations/{id}` | leitura | Uma operação com lançamentos. |
| `POST` | `/finance/operations/distributions` | edição | Distribuição: `actionId`, `allocations[]`, `description`, `date`. |
| `POST` | `/finance/operations/sub-action-transfers` | edição | Método A: `fromSubActionId`, `toSubActionId`, `amount`, `description`, `date`. |
| `POST` | `/finance/operations/action-transfers` | edição | Método B: mesmos campos do Método A. |
| `POST` | `/finance/operations/tac` | edição | Método C: `actionId`, `amount`, `allocations[]` (opcional), `description`, `date`. |
| `GET` | `/finance/commitments?actionId=&subActionId=&creditor=&status=` | leitura | Lista empenhos (mais recentes primeiro pela data do empenho). |
| `GET` | `/finance/commitments/{id}` | leitura | Empenho com todas as suas operações. |
| `POST` | `/finance/commitments` | edição | Empenha: `subActionId`, `number`, `creditor`, `description`, `amount`, `date`. |
| `PUT` | `/finance/commitments/{id}` | edição | Altera `number`, `creditor`, `description`. |
| `POST` | `/finance/commitments/{id}/liquidations` | edição | Liquida: `amount`, `description`, `date`. |
| `POST` | `/finance/commitments/{id}/payments` | edição | Paga: `amount`, `description`, `date`. |
| `POST` | `/finance/commitments/{id}/cancellations` | edição | Anula a parte não liquidada: `amount`, `description`, `date`. |

**Campos de resposta do financeiro:** `totalAmount`, `distributedAmount`, `undistributedAmount`, `balance` (dotação da subação), `committedAmount`, `liquidatedAmount`, `paidAmount`, `availableAmount`; nas operações, `number`, `method`, `methodLabel`, `operationDate` (data real), `registeredAt` (registro), `commitmentId`/`commitmentNumber` e `entries[]` (`kind`, `amount` com sinal); nos empenhos, `commitmentDate`, `cancelledAmount`, `toLiquidateAmount`, `toPayAmount`, `status`.

---

## Glossário

| Termo | Significado |
|---|---|
| Categoria nativa | Categoria cujos registros vivem em tabela própria com regras fixas (`clients`, `finance_actions`). |
| Categoria dinâmica | Categoria cujos campos são definidos em `category_fields` e os registros vivem em `dynamic_entities`. |
| Linha do tempo | Histórico imutável de um registro (`activities_ledger`). |
| Sigilo | Nível de confidencialidade de um documento (`ConfidentialityLevel`). |
| Ação | Unidade orçamentária com valor total, repartido entre subações. |
| Subação | Fatia de uma ação, com dotação própria e execução da despesa. |
| Dotação | Valor destinado à subação (`balance`); muda por distribuição, TAC e transferências. |
| Saldo a distribuir | Parte do valor total da ação ainda não repartida entre as subações. |
| Disponível | O que ainda pode ser empenhado ou transferido: dotação − empenhado (na ação: total − empenhado). |
| TAC | Termo aditivo: acréscimo de valor a uma ação (Método C). |
| Empenho | Reserva de parte do disponível para um favorecido; primeira etapa da despesa. |
| Anulação de empenho | Cancelamento da parte ainda não liquidada; o valor volta a ficar disponível. |
| Liquidação | Reconhecimento de que a despesa empenhada é devida (ex.: entrega conferida). |
| Pagamento | Saída do dinheiro; só até o valor liquidado. |
| Data real | Data em que a operação de fato aconteceu (`operation_date`), diferente do momento do registro. |
| Linha do tempo financeira | Toda operação com data passada é conferida dia a dia: disponível da subação, saldo a distribuir da ação e ordem empenho → liquidação → pagamento nunca podem ficar inválidos em nenhum dia. |
