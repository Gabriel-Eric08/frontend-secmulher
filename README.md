# Secretaria da Mulher · Frontend

Front do Sistema de Atendimento da Secretaria da Mulher de Pernambuco, sobre a API **OmniBase** (ver `backend.md`).
No domínio deste front, os **clients** do backend são as **mulheres atendidas**.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router 7 · TanStack Query 5 · Axios · lucide-react

## Rodando

```bash
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:8080
npm run dev              # http://localhost:5173 (já liberado no CORS padrão do backend)
npm run build            # typecheck + build de produção
```

## Estrutura

```
src/
├── api/            # Consumidores da API (um módulo por recurso) + tipos dos DTOs + http/erros
├── queries/        # Hooks React Query (cache, invalidação) sobre a camada api/
├── auth/           # AuthContext (login, /auth/me, expiração), guards de rota, regras de acesso
├── lib/format.ts   # Datas, telefone, rótulos em português (atividades, sigilo, operadores…)
├── components/
│   ├── ui/         # Botões, formulários, modal, confirmação, toast, badges, estados
│   ├── layout/     # AppLayout (faixa institucional, menu lateral)
│   ├── records/    # Linha do tempo, documentos, atendimento manual (mulheres e cadastros)
│   ├── dynamic/    # Campo dinâmico por tipo e construtor de filtros da busca
│   └── admin/      # Modais de funcionária, permissão, categoria e campo
└── pages/          # Painel, mulheres, cadastros (categorias dinâmicas), admin, perfil
```

## Rotas

| Rota | Tela |
|---|---|
| `/` | Painel |
| `/mulheres`, `/mulheres/nova`, `/mulheres/:id`, `/mulheres/:id/editar` | Mulheres atendidas (`/clients`) |
| `/cadastros/:categoryId[/novo|/:id|/:id/editar]` | Categorias dinâmicas (`/dynamic-entities`) |
| `/admin/funcionarias[/:id]` | Usuárias, permissões e auditoria |
| `/admin/categorias[/:id/campos]` | Categorias e campos personalizados |
| `/admin/categorias/:id/tipos` | Tipos de registro da linha do tempo da categoria |
| `/admin/permissoes` | Matriz funcionária × categoria |
| `/perfil` | Troca de senha e acessos efetivos |

## Controle de acesso no front

O front só **reflete** as permissões de `/auth/me` (esconde botões, desabilita campos, marca valores como
"restrito"); a autorização de verdade é sempre do backend. Ver `src/auth/access.ts`.
