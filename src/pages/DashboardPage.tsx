import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, FolderKanban, Settings2, UserPlus, Users, UsersRound, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { MULHERES_TABLE } from '@/auth/access'
import { useCategories, useUsers } from '@/queries/admin'
import { useMulheres } from '@/queries/records'
import { useFinanceDashboard } from '@/queries/finance'
import { formatMoneyCompact, formatPct } from '@/lib/finance'
import { formatRelative } from '@/lib/format'
import { Card, PageHeader, StatCard, Avatar } from '@/components/ui/Layout'
import { Badge, HiddenValue } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Alert, EmptyState } from '@/components/ui/States'
import { LoadingBlock } from '@/components/ui/Spinner'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export function DashboardPage() {
  const { user, isAdmin, mulheresAccess, financeAccess } = useAuth()
  const finance = useFinanceDashboard(undefined, financeAccess.canRead)
  const mulheres = useMulheres(mulheresAccess.canRead)
  const categories = useCategories()
  const users = useUsers(isAdmin)

  const list = mulheres.data ?? []
  const riskVisible = mulheresAccess.canReadColumn('sob_risco')
  const emRisco = list.filter((m) => m.sobRisco).length
  const recentes = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
  const dinamicas = (categories.data ?? []).filter((c) => c.entityType === 'dynamic' && c.isActive)
  const hasMulheresCategory = (categories.data ?? []).some(
    (c) => c.entityType === 'native' && c.tableReference === MULHERES_TABLE,
  )

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0] ?? ''}`}
        description="Visão geral do atendimento da Secretaria da Mulher."
        actions={
          mulheresAccess.canCreate && (
            <ButtonLink to="/mulheres/nova" icon={<UserPlus className="size-4" />}>
              Novo cadastro
            </ButtonLink>
          )
        }
      />

      {isAdmin && categories.isSuccess && !hasMulheresCategory && (
        <div className="mb-6">
          <Alert
            tone="warning"
            title="Categoria de mulheres atendidas não configurada"
            action={
              <ButtonLink to="/admin/categorias?setup=mulheres" size="sm" variant="secondary">
                Configurar agora
              </ButtonLink>
            }
          >
            Sem ela, apenas administradoras acessam os cadastros. Crie a categoria nativa para conceder permissões à
            equipe.
          </Alert>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {mulheresAccess.canRead && (
          <StatCard
            label="Mulheres atendidas"
            value={mulheres.isPending ? '…' : list.length}
            icon={<UsersRound className="size-5" />}
            to="/mulheres"
          />
        )}
        {mulheresAccess.canRead && riskVisible && (
          <StatCard
            label="Em situação de risco"
            value={mulheres.isPending ? '…' : emRisco}
            hint={list.length ? `${Math.round((emRisco / list.length) * 100)}% do total` : undefined}
            icon={<AlertTriangle className="size-5" />}
            to="/mulheres?risco=1"
          />
        )}
        {financeAccess.canRead && (
          <StatCard
            label="Disponível no orçamento"
            value={finance.data ? formatMoneyCompact(finance.data.availableAmount) : '…'}
            hint={finance.data ? `${formatPct(finance.data.committedAmount, finance.data.totalAmount)} empenhado de ${formatMoneyCompact(finance.data.totalAmount)}` : undefined}
            icon={<Wallet className="size-5" />}
            to="/financeiro"
          />
        )}
        <StatCard
          label="Cadastros disponíveis"
          value={categories.isPending ? '…' : dinamicas.length}
          icon={<FolderKanban className="size-5" />}
        />
        {isAdmin && (
          <StatCard
            label="Funcionárias"
            value={users.isPending ? '…' : (users.data?.filter((u) => u.isActive).length ?? 0)}
            hint="ativas"
            icon={<Users className="size-5" />}
            to="/admin/funcionarias"
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {mulheresAccess.canRead && (
          <Card
            className="lg:col-span-2"
            title="Cadastros recentes"
            padded={false}
            actions={
              <Link to="/mulheres" className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                Ver todas <ArrowRight className="size-3" />
              </Link>
            }
          >
            {mulheres.isPending ? (
              <LoadingBlock />
            ) : recentes.length === 0 ? (
              <EmptyState title="Nenhuma mulher cadastrada ainda" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {recentes.map((m) => (
                  <li key={m.id}>
                    <Link to={`/mulheres/${m.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50">
                      <Avatar name={m.nome} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-800">{m.nome ?? <HiddenValue />}</p>
                        <p className="text-xs text-ink-500">Cadastrada {formatRelative(m.createdAt)}</p>
                      </div>
                      {m.sobRisco && <Badge tone="danger">Em risco</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card title="Cadastros" padded={false} className={mulheresAccess.canRead ? '' : 'lg:col-span-3'}>
          {dinamicas.length === 0 ? (
            <EmptyState
              title="Nenhum cadastro disponível"
              description={isAdmin ? 'Crie categorias como abrigos, cursos ou parceiros.' : undefined}
              action={
                isAdmin && (
                  <ButtonLink to="/admin/categorias" size="sm" variant="secondary" icon={<Settings2 className="size-4" />}>
                    Gerenciar categorias
                  </ButtonLink>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {dinamicas.map((c) => (
                <li key={c.id}>
                  <Link to={`/cadastros/${c.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-ink-50">
                    <FolderKanban className="size-4 text-brand-600" />
                    <span className="flex-1 text-ink-800">{c.name}</span>
                    <ArrowRight className="size-4 text-ink-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
