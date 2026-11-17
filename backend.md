# OmniBase: Backend

API REST para cadastro e acompanhamento de pessoas atendidas e de qualquer outro tipo de registro que a instituição precise manter, com **controle de acesso granular por usuário, categoria e coluna**, **linha do tempo auditável** e **documentos com nível de sigilo**.

Foi pensada para serviços de atendimento como uma Secretaria da Mulher, onde diferentes profissionais (recepção, assistência social, psicologia, coordenação, instrutoras de cursos) trabalham sobre os mesmos cadastros, mas cada uma só pode ver e alterar o que é necessário para a sua função.

---

## Sumário

- [Intuito e conceitos](#intuito-e-conceitos)
- [Tecnologias](#tecnologias)
- [Como rodar](#como-rodar)
- [Configuração (`.env`)](#configuração-env)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Modelo de dados](#modelo-de-dados)
- [Autenticação](#autenticação)
- [Controle de acesso](#controle-de-acesso)
- [Rotas](#rotas)
  - [Auth](#auth)
  - [Usuários](#usuários)
  - [Categorias](#categorias)
  - [Campos personalizados](#campos-personalizados-de-categorias-dinâmicas)
  - [Permissões](#permissões)
  - [Clientes](#clientes)
  - [Entidades dinâmicas](#entidades-dinâmicas)
  - [Busca com filtros](#busca-com-filtros)
  - [Linha do tempo, documentos e visão 360°](#linha-do-tempo-documentos-e-visão-360)
  - [Arquivos](#arquivos)
- [Erros](#erros)
- [Dados de demonstração](#dados-de-demonstração)
- [Fluxo típico de uso](#fluxo-típico-de-uso)

---

## Intuito e conceitos

| Conceito | O que é |
|---|---|
| **Usuário** | Funcionária ou funcionário que acessa o sistema. Pode ser **administrador global**, com acesso total, ou usuário comum, que depende das permissões. |
| **Categoria** | Um tipo de cadastro. Pode ser **nativa** (`native`), que aponta para uma tabela própria do sistema, hoje `clients`, ou **dinâmica** (`dynamic`), cujos registros ficam em `dynamic_entities` e têm campos definidos pelo administrador. |
| **Cliente** | Pessoa atendida. Tabela nativa com `nome`, `data_nascimento`, `telefone` e `sob_risco`. |
| **Entidade dinâmica** | Registro de uma categoria dinâmica (ex.: abrigos, cursos, municípios parceiros). Os valores ficam em JSONB e são validados contra os **campos personalizados** da categoria. |
| **Permissão** | Liga um usuário a uma categoria: o que ele pode fazer (ler, criar, editar, excluir), **quais colunas** pode ler e escrever e o **nível máximo de sigilo** de documentos que pode acessar. |
| **Linha do tempo** | Histórico imutável de cada registro (`activities_ledger`). Guarda ações automáticas de auditoria (criação, edição com valor antigo e novo, documentos) e atendimentos registrados manualmente. |
| **Documento** | Arquivo anexado a um registro, com nível de sigilo `INTERNAL`, `RESTRICTED` ou `CONFIDENTIAL`. |

Princípios do projeto:

- **A autorização fica no backend.** Toda regra de acesso é aplicada nos services, via `AccessControlService`, e vale igual para qualquer front ou integração.
- **Nada vaza.** Colunas sem permissão de leitura voltam `null` ou são removidas e listadas em `hiddenFields`. O histórico também oculta valores de colunas e nomes de documentos que o usuário não pode ver. Filtrar ou ordenar por campo oculto é proibido.
- **Tudo é auditado.** Criação, edição, exclusão, upload, mudança de sigilo e download de documentos restritos ou sigilosos ficam na linha do tempo, pensando na LGPD.

---

## Tecnologias

- **Java 27** e **Spring Boot 4.1** (Web MVC, Data JPA, Validation, Security, OAuth2 Resource Server)
- **PostgreSQL**: JSONB para os campos dinâmicos, permissões por coluna e histórico de alterações
- **JWT HS256** (Nimbus) para autenticação stateless e **BCrypt** para senhas
- **Lombok**
- **Maven**: use o wrapper `./mvnw`, não é preciso instalar o Maven

---

## Como rodar

### Pré-requisitos

- JDK 27
- PostgreSQL acessível (padrão: `localhost:5432`)

### 1. Criar o banco e o schema

O schema **não** é criado pelo Hibernate (`ddl-auto=validate`). Ele vem do script `src/main/resources/static/init.sql`:

```bash
createdb -U postgres omnibase
psql -U postgres -d omnibase -f src/main/resources/static/init.sql
```

O script é idempotente (`CREATE ... IF NOT EXISTS`) e habilita a extensão `pgcrypto`, usada por `gen_random_uuid()`.

### 2. Criar o `.env`

Na raiz do `backend/`. Veja a [tabela completa](#configuração-env).

```properties
DB_URL=jdbc:postgresql://localhost:5432/omnibase
DB_USERNAME=postgres
DB_PASSWORD=sua_senha
JWT_SECRET=uma_chave_com_pelo_menos_32_caracteres
ADMIN_EMAIL=admin@omnibase.local
ADMIN_PASSWORD=Admin@2026
```

O `.env` é carregado automaticamente (`spring.config.import=optional:file:.env[.properties]`) e está no `.gitignore`. **Nunca versione esse arquivo.** Variáveis de ambiente do sistema têm prioridade sobre ele.

### 3. Subir a aplicação

```bash
./mvnw spring-boot:run                                      # API em http://localhost:8080
./mvnw spring-boot:run -Dspring-boot.run.profiles=seed      # com dados de demonstração
./mvnw test                                                 # testes
./mvnw clean package && java -jar target/demo-*.jar         # build para produção
```

No primeiro início, se o banco não tiver nenhum usuário, o administrador definido em `ADMIN_EMAIL`/`ADMIN_PASSWORD` é criado automaticamente (`AdminBootstrap`).

---

## Configuração (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/omnibase` | URL JDBC do PostgreSQL |
| `DB_USERNAME` | `postgres` | Usuário do banco |
| `DB_PASSWORD` | *(vazio)* | Senha do banco |
| `JWT_SECRET` | *(vazio)* | Segredo do JWT, com **no mínimo 32 bytes**. Sem ele, uma chave aleatória é gerada a cada início e todos os tokens expiram ao reiniciar (só serve para desenvolvimento). |
| `JWT_EXPIRATION` | `8h` | Validade do token (`30m`, `8h`, `1d`...) |
| `ADMIN_NAME` | `Administrador` | Nome do primeiro administrador |
| `ADMIN_EMAIL` | *(vazio)* | E-mail do primeiro administrador; só é usado com o banco sem usuários |
| `ADMIN_PASSWORD` | *(vazio)* | Senha do primeiro administrador |
| `STORAGE_PATH` | `./storage` | Pasta onde os documentos enviados são gravados (no `.gitignore`) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Origens do front autorizadas, separadas por vírgula |
| `SEED_PASSWORD` | `Demo@2026` | Senha dos usuários de demonstração (profile `seed`) |

Limite de upload: **20 MB** por arquivo.

---

## Estrutura do projeto

```
src/main/java/com/secmulher/
├── Application.java
├── controllers/            # Rotas REST + GlobalExceptionHandler (formato dos erros)
├── domain/
│   ├── access/             # AccessControlService e CategoryAccess: regras de autorização
│   ├── dtos/               # Records de request/response
│   ├── enums/              # RecordType, FilterOperator
│   ├── exceptions/         # NotFound, Forbidden, Conflict, Business, FieldValidation...
│   └── services/           # Regras de negócio (um service por recurso)
└── infra/
    ├── config/             # AdminBootstrap (primeiro administrador)
    ├── entities/           # Entidades JPA e enums (FieldType, ActivityType, ConfidentialityLevel)
    ├── repositories/       # Spring Data + DynamicEntitySearchRepository (filtros sobre JSONB)
    ├── security/           # SecurityConfig, TokenService, CurrentUserProvider
    └── seed/               # DemoDataSeeder (profile "seed")
src/main/resources/
├── application.properties
└── static/init.sql         # Schema do banco
```

---

## Modelo de dados

| Tabela | Conteúdo |
|---|---|
| `users` | Usuários (`is_global_admin`, `is_active`, senha em BCrypt) |
| `categories` | Categorias: `entity_type` (`native`/`dynamic`) e `table_reference` (ex.: `clients`) |
| `permissions` | Matriz usuário × categoria: `can_read/create/update/delete`, `allowed_columns` (JSONB) e `max_confidentiality` |
| `clients` | Pessoas atendidas (tabela nativa) |
| `category_fields` | Definição dos campos de cada categoria dinâmica (o "formulário") |
| `dynamic_entities` | Registros das categorias dinâmicas; valores em `custom_fields` (JSONB, com índice GIN) |
| `activities_ledger` | Linha do tempo e auditoria de cada registro (polimórfica: `entity_type` + `entity_id`) |
| `files` | Metadados dos documentos (o arquivo físico fica em `STORAGE_PATH`, com nome UUID) |

> Uma categoria com registros em `dynamic_entities` não pode ser excluída enquanto eles existirem (`ON DELETE RESTRICT`). A API responde **409**.

---

## Autenticação

1. `POST /auth/login` com e-mail e senha devolve um **JWT**.
2. Todas as outras rotas exigem o cabeçalho:
   ```
   Authorization: Bearer <token>
   ```
3. Sem token, ou com token inválido ou expirado, a resposta é **401**.

Detalhes:

- **Login errado:** e-mail inexistente, senha errada e usuário inativo devolvem a mesma resposta (401), com tempo de resposta equivalente, para não revelar quais e-mails existem.
- **Sem estado:** não há sessão nem CSRF. O token carrega o id do usuário (`sub`) e o nome.
- **CORS:** expõe os cabeçalhos `Location`, usado nas respostas 201, e `Content-Disposition`, usado nos downloads.

---

## Controle de acesso

### Administrador global vs. usuário comum

- **Administrador global** (`isGlobalAdmin: true`): acesso total a tudo. É o único que gerencia usuários, categorias, campos e permissões.
- **Usuário comum**: só acessa as categorias em que tem permissão, dentro dos limites dela.

### Permissão por categoria

```json
{
  "userId": "…",
  "categoryId": "…",
  "canRead": true,
  "canCreate": false,
  "canUpdate": true,
  "canDelete": false,
  "allowedColumns": { "read": ["nome", "telefone"], "write": ["telefone"] },
  "maxConfidentiality": "RESTRICTED"
}
```

| Regra | Comportamento |
|---|---|
| Sem permissão na categoria | 403 em qualquer operação com os registros dela |
| `allowedColumns.read` | Lista das colunas legíveis. **Sem a chave, todas são legíveis.** As demais voltam `null` (clientes) ou são removidas (dinâmicas) e aparecem em `hiddenFields`. |
| `allowedColumns.write` | Lista das colunas que podem ser escritas. **Sem a chave, todas podem.** |
| Criar preenchendo coluna sem permissão de escrita | 403 `Sem permissão para preencher: …` |
| Editar alterando coluna sem permissão de escrita | 403 `Sem permissão para alterar: …`. Reenviar o **valor atual** é aceito, então o front pode mandar o objeto inteiro no `PUT`. |
| Colunas ocultas na edição | São preservadas com o valor atual |
| Filtrar ou ordenar por coluna oculta | 403, porque o resultado revelaria o valor |
| Documentos | Só aparecem e podem ser baixados se o sigilo for ≤ `maxConfidentiality` (`INTERNAL` < `RESTRICTED` < `CONFIDENTIAL`) |
| Histórico | Valores de colunas ocultas e eventos de documentos acima do nível são ocultados (`redacted: true`) |

### Categoria nativa de clientes

Os registros de `clients` pertencem à categoria cujo `tableReference` é `"clients"`. **Crie essa categoria** (`entityType: "native"`) para poder dar permissões sobre clientes a usuários comuns. Sem ela, só administradores acessam clientes.

### Regras de proteção

- O administrador não pode remover o próprio acesso de administrador, se desativar nem excluir o próprio usuário (422).
- Atendimentos manuais na linha do tempo exigem permissão de **edição** no registro.

---

## Rotas

Convenções:

- **Formato:** JSON (`Content-Type: application/json`), exceto o upload, que usa `multipart/form-data`.
- **IDs:** UUID.
- **Datas:** `AAAA-MM-DD`; data e hora, ISO-8601.
- **Respostas:** criação devolve **201** com o cabeçalho `Location`; exclusão e troca de senha, **204**.
- **Coluna "Acesso"** nas tabelas abaixo: `público` = sem token; `autenticado` = qualquer usuário logado; `admin` = só administrador global; `permissão` = depende da matriz de permissões.

### Auth

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/auth/login` | público | Login |
| `GET` | `/auth/me` | autenticado | Usuário logado e acesso efetivo por categoria |
| `PUT` | `/auth/me/password` | autenticado | Troca a própria senha |

**`POST /auth/login`**
```json
// request
{ "email": "admin@omnibase.local", "password": "Admin@2026" }
// 200
{
  "token": "eyJhbGciOiJIUzI1NiJ9…",
  "tokenType": "Bearer",
  "expiresAt": "2026-11-17T21:44:49Z",
  "user": { "id": "…", "name": "Administrador", "email": "admin@omnibase.local",
            "isGlobalAdmin": true, "isActive": true, "createdAt": "…", "updatedAt": "…" }
}
```

**`GET /auth/me`**: feito para o front montar menus e telas sem chamadas extras.
```json
{
  "user": { "id": "…", "name": "Operadora", "isGlobalAdmin": false, "…": "…" },
  "access": [
    {
      "categoryId": "…", "categoryName": "Mulheres atendidas",
      "entityType": "native", "tableReference": "clients",
      "canRead": true, "canCreate": false, "canUpdate": true, "canDelete": false,
      "allowedColumns": { "read": ["nome", "telefone"], "write": ["telefone"] },
      "maxConfidentiality": "INTERNAL"
    }
  ]
}
```

**`PUT /auth/me/password`**: `{ "currentPassword": "…", "newPassword": "…" }` (mínimo de 6 caracteres). Responde 204; senha atual errada dá 422.

### Usuários

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/users` | admin | Lista usuários |
| `GET` | `/users/{id}` | admin ou o próprio | Busca usuário |
| `GET` | `/users/{id}/activities` | admin ou o próprio | Ações realizadas pelo usuário (auditoria) |
| `POST` | `/users` | admin | Cria usuário |
| `PUT` | `/users/{id}` | admin | Atualiza usuário |
| `DELETE` | `/users/{id}` | admin | Exclui usuário |

```json
// POST/PUT /users
{
  "name": "Fernanda Lima",
  "email": "fernanda@exemplo.org",
  "password": "Senha@123",   // obrigatório na criação; no PUT, se omitido, mantém a atual
  "isGlobalAdmin": false,
  "isActive": true
}
```
E-mail duplicado dá **409**.

### Categorias

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/categories` | autenticado | Lista categorias (o usuário comum só vê as que pode ler) |
| `GET` | `/categories/{id}` | autenticado | Busca categoria |
| `POST` | `/categories` | admin | Cria categoria |
| `PUT` | `/categories/{id}` | admin | Atualiza categoria |
| `DELETE` | `/categories/{id}` | admin | Exclui categoria (409 se ainda houver entidades dinâmicas) |

```json
// POST/PUT /categories
{
  "name": "Abrigos",
  "entityType": "dynamic",        // "native" ou "dynamic"
  "tableReference": "abrigos",    // para clientes: "clients"
  "isActive": true                // categorias inativas não recebem novos registros
}
```

### Campos personalizados (de categorias dinâmicas)

São os campos do "formulário" de uma categoria dinâmica. A `key` é o nome usado em `customFields` e em `allowedColumns`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/categories/{categoryId}/fields` | permissão de leitura | Lista campos (o usuário só vê a definição dos campos que pode ler) |
| `POST` | `/categories/{categoryId}/fields` | admin | Cria campo |
| `PUT` | `/categories/{categoryId}/fields/{fieldId}` | admin | Atualiza campo |
| `DELETE` | `/categories/{categoryId}/fields/{fieldId}?purgeData=false` | admin | Remove campo |

```json
// POST/PUT
{
  "key": "regiao",              // minúsculas, números e "_", começando por letra; não pode mudar depois
  "label": "Região",
  "fieldType": "LIST",          // TEXT | NUMBER | BOOLEAN | LIST | DATE
  "isRequired": false,
  "options": ["Norte", "Sul", "Centro"],   // obrigatório (e só usado) em LIST
  "position": 3                 // ordem de exibição
}
// resposta
{
  "id": "…", "categoryId": "…", "key": "regiao", "label": "Região", "fieldType": "LIST",
  "isRequired": false, "options": ["Norte", "Sul", "Centro"], "position": 3,
  "filterOperators": ["EQUALS", "NOT_EQUALS", "IN", "IS_EMPTY", "NOT_EMPTY"],
  "createdAt": "…"
}
```

**Tipos de campo**

| Tipo | Valor aceito | Exemplo |
|---|---|---|
| `TEXT` | Texto livre, sem formatação específica | `"Casa Rosa"` |
| `NUMBER` | Número (inteiro ou decimal) | `20`, `12.5` |
| `BOOLEAN` | `true` / `false` | `true` |
| `LIST` | Uma das `options` do campo | `"Sul"` |
| `DATE` | Data `AAAA-MM-DD` | `"2020-03-01"` |

`filterOperators` informa ao front quais operadores de [busca](#busca-com-filtros) aquele campo aceita.

**Regras de integridade:**

- **Chave duplicada:** 409.
- **Chave:** não pode ser alterada (422). Crie um campo novo.
- **Tipo:** trocar o tipo de um campo que **já tem dados** dá 409.
- **Opções de LIST:** remover uma opção que **ainda é usada** por algum registro dá 409, e a mensagem lista as opções em uso. Adicionar opções e remover opções sem uso é permitido.
- **Exclusão:** excluir um campo com dados dá 409. Com `?purgeData=true`, o campo é removido e o valor é apagado de todos os registros.

### Permissões

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/permissions?userId={id}` | admin | Lista permissões (filtro por usuário opcional) |
| `GET` | `/permissions/{id}` | admin | Busca permissão |
| `POST` | `/permissions` | admin | Cria permissão |
| `PUT` | `/permissions/{id}` | admin | Atualiza permissão |
| `DELETE` | `/permissions/{id}` | admin | Remove permissão |

O corpo está descrito em [Controle de acesso](#permissão-por-categoria). `maxConfidentiality`, se omitido, vale `INTERNAL`. Cada usuário tem **uma** permissão por categoria; uma segunda para o mesmo par usuário/categoria dá **409**, então use o `PUT` para alterar.

### Clientes

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/clients` | permissão (leitura) | Lista clientes |
| `GET` | `/clients/{id}` | permissão (leitura) | Busca cliente |
| `POST` | `/clients` | permissão (criação) | Cria cliente |
| `PUT` | `/clients/{id}` | permissão (edição) | Atualiza cliente |
| `DELETE` | `/clients/{id}` | permissão (exclusão) | Exclui cliente e seus documentos (o histórico permanece) |

```json
// POST/PUT
{ "nome": "Maria Silva", "dataNascimento": "1990-05-10", "telefone": "11999990000", "sobRisco": true }
// resposta (usuário que só pode ler nome e telefone)
{
  "id": "…", "nome": "Maria Silva", "dataNascimento": null, "telefone": "11999990000", "sobRisco": null,
  "createdBy": "…", "createdAt": "…", "updatedAt": "…",
  "hiddenFields": ["data_nascimento", "sob_risco"]
}
```

| Campo da API | Coluna (`allowedColumns`) | Regra |
|---|---|---|
| `nome` | `nome` | obrigatório, até 255 caracteres |
| `dataNascimento` | `data_nascimento` | data no passado |
| `telefone` | `telefone` | até 50 caracteres |
| `sobRisco` | `sob_risco` | booleano; padrão `false` |

### Entidades dinâmicas

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/dynamic-entities?categoryId={id}` | permissão (leitura) | Lista registros. Sem `categoryId`, devolve os de todas as categorias que o usuário pode ler. |
| `GET` | `/dynamic-entities/{id}` | permissão (leitura) | Busca registro |
| `POST` | `/dynamic-entities/search` | permissão (leitura) | [Busca com filtros](#busca-com-filtros) |
| `POST` | `/dynamic-entities` | permissão (criação) | Cria registro |
| `PUT` | `/dynamic-entities/{id}` | permissão (edição) | Atualiza registro |
| `DELETE` | `/dynamic-entities/{id}` | permissão (exclusão) | Exclui registro e seus documentos (o histórico permanece) |

```json
// POST/PUT
{
  "categoryId": "…",
  "customFields": { "nome": "Casa Rosa", "vagas": 20, "ativo": true, "regiao": "Norte", "inaugurado": "2020-03-01" }
}
// resposta (campos sem permissão de leitura são removidos)
{
  "id": "…", "categoryId": "…",
  "customFields": { "nome": "Casa Rosa", "vagas": 20, "regiao": "Norte" },
  "createdBy": "…", "createdAt": "…", "updatedAt": "…",
  "hiddenFields": ["ativo", "inaugurado"]
}
```

- **Validação:** os valores são validados contra os campos da categoria. Campo inexistente, obrigatório ausente, tipo errado ou opção fora da lista dão **400**, com o erro por campo em `errors`.
- **Categoria:** precisa ser `dynamic` e estar ativa (senão, 422).
- **Mover de categoria:** é possível trocando o `categoryId` no `PUT`, mas exige permissão de criação na categoria de destino.

### Busca com filtros

`POST /dynamic-entities/search`: pensada para as telas de filtro do front.

```json
{
  "categoryId": "…",
  "filters": [
    { "field": "nome",       "operator": "CONTAINS", "value": "casa" },
    { "field": "vagas",      "operator": "BETWEEN",  "value": [5, 20] },
    { "field": "regiao",     "operator": "IN",       "value": ["Norte", "Sul"] },
    { "field": "ativo",      "operator": "EQUALS",   "value": true },
    { "field": "inaugurado", "operator": "GTE",      "value": "2020-01-01" },
    { "field": "telefone",   "operator": "IS_EMPTY" }
  ],
  "sort": { "field": "vagas", "direction": "asc" },
  "fields": { "regiao": "Sul" }
}
```

- **`filters`:** combinados com **E**, no máximo 30.
- **`fields`** (opcional): atalho de igualdade exata. Cada par equivale a um filtro `EQUALS`.
- **`sort`** (opcional): qualquer campo da categoria, ou `createdAt`/`updatedAt`. A direção `asc`/`desc` vale `desc` por padrão. Sem `sort`, a ordem é `createdAt` decrescente. Registros sem o campo vão para o fim.
- **Resposta:** lista de entidades no mesmo formato de `GET /dynamic-entities/{id}`.

**Operadores por tipo**

| Operador | `value` | TEXT | NUMBER | DATE | LIST | BOOLEAN |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `EQUALS` | valor | ✔ | ✔ | ✔ | ✔ | ✔ |
| `NOT_EQUALS` | valor (inclui registros sem o campo) | ✔ | ✔ | ✔ | ✔ | |
| `CONTAINS` | texto, sem diferenciar maiúsculas | ✔ | | | | |
| `STARTS_WITH` | texto, sem diferenciar maiúsculas | ✔ | | | | |
| `IN` | lista de 1 a 100 valores | ✔ | | | ✔ | |
| `GT` `GTE` `LT` `LTE` | valor | | ✔ | ✔ | | |
| `BETWEEN` | `[mínimo, máximo]`, inclusivo | | ✔ | ✔ | | |
| `IS_EMPTY` / `NOT_EMPTY` | não usa | ✔ | ✔ | ✔ | ✔ | ✔ |

- **Formato dos valores:** `NUMBER` aceita número ou texto numérico (`"5"`), `DATE` usa `AAAA-MM-DD` e `BOOLEAN` aceita `true`/`false`. Em `LIST`, os valores precisam estar entre as opções do campo.
- **Erros de filtro:** voltam todos juntos (400), indicando qual filtro está errado:
  ```json
  { "status": 400, "detail": "Filtros de busca inválidos",
    "errors": { "filters[0]": "operador CONTAINS não se aplica a campos BOOLEAN; use um de [EQUALS, IS_EMPTY, NOT_EMPTY]" } }
  ```
- **Campo oculto:** filtrar ou ordenar por um campo sem permissão de leitura dá **403**.
- **Segurança:** os valores e os nomes dos campos são enviados como parâmetros da consulta, sem concatenação de SQL.

> A busca devolve todos os resultados de uma vez, sem paginação.

### Linha do tempo, documentos e visão 360°

Rotas compartilhadas por clientes e entidades dinâmicas: `{tipo}` é `clients` ou `dynamic-entities`.

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/{tipo}/{id}/overview` | leitura | Visão 360°: registro + linha do tempo + documentos em uma resposta |
| `GET` | `/{tipo}/{id}/activities` | leitura | Linha do tempo do registro |
| `POST` | `/{tipo}/{id}/activities` | edição | Registra um atendimento manual |
| `GET` | `/{tipo}/{id}/files` | leitura | Documentos do registro (só os de sigilo permitido) |
| `POST` | `/{tipo}/{id}/files` | edição | Envia documento (`multipart/form-data`) |

**Atendimento manual**
```json
{
  "actionType": "SERVICE",              // TRIAGE | SERVICE | FOLLOW_UP | NOTE
  "description": "Atendimento psicológico inicial",
  "responsibleEmployee": "Fernanda Lima",   // opcional
  "occurredAt": "2026-11-17T10:00:00"       // opcional, não pode ser no futuro; padrão: agora
}
```

**Tipos de atividade**

| Manuais | Automáticas (auditoria; não podem ser criadas pela API, que responde 422) |
|---|---|
| `TRIAGE`, `SERVICE`, `FOLLOW_UP`, `NOTE` | `CREATED`, `UPDATED`, `DELETED`, `FILE_UPLOADED`, `FILE_UPDATED`, `FILE_REMOVED`, `FILE_DOWNLOADED` |

Cada atividade traz `changes` (em `UPDATED`: `{"campo": {"antigo": …, "novo": …}}`) e `redacted: true` quando parte do conteúdo foi ocultada para o usuário.

**Upload de documento**
```bash
curl -X POST http://localhost:8080/clients/{id}/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@laudo.pdf" \
  -F "confidentialityLevel=CONFIDENTIAL"     # INTERNAL | RESTRICTED (padrão) | CONFIDENTIAL
```
O usuário só pode enviar documentos com sigilo até o seu `maxConfidentiality`.

### Arquivos

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/files/{id}` | leitura + sigilo | Metadados do documento |
| `GET` | `/files/{id}/download` | leitura + sigilo | Baixa o arquivo (sempre como anexo) |
| `PATCH` | `/files/{id}` | edição + sigilo | Altera o nível de sigilo: `{ "confidentialityLevel": "RESTRICTED" }` |
| `DELETE` | `/files/{id}` | exclusão + sigilo | Remove o documento |

- **Download:** sempre vem com `Content-Disposition: attachment`, para o navegador não renderizar conteúdo enviado por terceiros. Downloads de documentos `RESTRICTED` ou `CONFIDENTIAL` são registrados na linha do tempo (`FILE_DOWNLOADED`).
- **Mudança de sigilo:** exige que o usuário tenha acesso tanto ao nível antigo quanto ao novo.
- **Armazenamento:** o arquivo físico é gravado com nome UUID; o nome original é só metadado.

---

## Erros

Todos os erros seguem o formato **Problem Details** (RFC 9457):

```json
{
  "title": "Bad Request",
  "status": 400,
  "detail": "Dados inválidos",
  "instance": "/clients",
  "errors": { "dataNascimento": "deve ser uma data passada" }
}
```

| Status | Quando |
|---|---|
| **400** | JSON malformado, validação de campos (`errors` por campo), valores de campos dinâmicos ou filtros inválidos, enum desconhecido (a mensagem lista os valores válidos) |
| **401** | Sem token, token inválido ou expirado, login inválido |
| **403** | Autenticado, mas sem permissão (rota de admin, categoria, coluna ou nível de sigilo) |
| **404** | Recurso não encontrado |
| **409** | Conflito: e-mail ou chave duplicados, categoria com registros, campo com dados, opção em uso |
| **413** | Arquivo acima de 20 MB |
| **422** | Regra de negócio: categoria não dinâmica ou inativa, tipo de atividade automático, senha atual incorreta, chave de campo alterada, administrador tentando se bloquear |

---

## Dados de demonstração

Com o profile `seed`, a aplicação cria dados fictícios para apresentação e testes do front:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=seed
```

- **Funcionárias:** cinco perfis, todos com a senha `SEED_PASSWORD` (padrão `Demo@2026`):

  | E-mail | Perfil |
  |---|---|
  | `coordenacao@secmulher.demo` | Coordenação (administradora) |
  | `psicologia@secmulher.demo` | Psicóloga (única com acesso a documentos sigilosos) |
  | `assistencia@secmulher.demo` | Assistente social |
  | `recepcao@secmulher.demo` | Recepção (não vê situação de risco nem laudos) |
  | `cursos@secmulher.demo` | Instrutora de cursos (só vê contato das atendidas) |

- **Atendidas:** mulheres com histórico completo (chegada, triagem, atendimentos, cursos) e PDFs simulando documentos.
- **Execução:** o seed não roda de novo se já tiver sido aplicado.

---

## Fluxo típico de uso

1. **Login como administrador**: `POST /auth/login`.
2. **Criar a categoria de clientes**: `POST /categories` com `{"name": "Mulheres atendidas", "entityType": "native", "tableReference": "clients"}`.
3. **Criar categorias dinâmicas** e seus campos: `POST /categories` com `entityType: "dynamic"` e depois `POST /categories/{id}/fields` para cada campo.
4. **Cadastrar as funcionárias**: `POST /users`.
5. **Dar permissões**: `POST /permissions` para cada funcionária e categoria, definindo colunas e nível de sigilo.
6. **No front**, após o login de cada funcionária:
   - `GET /auth/me` para montar menus e telas conforme o acesso;
   - `GET /categories/{id}/fields` para montar formulários e filtros dinâmicos (`fieldType`, `options`, `filterOperators`);
   - `GET /clients` / `POST /dynamic-entities/search` para as listagens com filtros;
   - `GET /{tipo}/{id}/overview` para a ficha completa do registro.
