import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowLeftRight,
  CalendarCheck2,
  CalendarRange,
  Car,
  ChevronRight,
  LayoutGrid,
  SlidersHorizontal,
  CarFront,
  IdCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  UserCircle2,
  Users,
  UsersRound,
  Wallet,
  X,
  Building2,
  Landmark,
  ScrollText,
  Target,
  ListChecks,
  KanbanSquare,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useCategories } from '@/queries/admin'
import { Avatar } from '@/components/ui/Layout'
import { TopProgressBar } from '@/components/ui/Spinner'
import { ThemeToggle } from '@/theme/ThemeToggle'
import { useIsDriver } from '@/queries/fleet'
import { BrandMark } from './BrandMark'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
  /** Outros caminhos que também marcam o item como ativo */
  also?: string[]
  /** Caminhos que, mesmo abaixo de `to`, pertencem a outro item */
  except?: string[]
}

const isItemActive = (it: NavItem, pathname: string) =>
  !it.except?.some((p) => pathname.startsWith(p)) &&
  ((it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(`${it.to}/`)) ||
    !!it.also?.some((p) => pathname.startsWith(p)))

function NavItems({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  const { pathname } = useLocation()
  return (
    <ul className="space-y-0.5">
      {items.map((it) => {
        const active = isItemActive(it, pathname)
        return (
          <li key={it.to}>
            <NavLink
              to={it.to}
              end={it.end}
              onClick={onNavigate}
              className={clsx(
                'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                active
                  ? 'bg-brand-50 font-medium text-brand-800'
                  : 'text-ink-600 hover:translate-x-0.5 hover:bg-ink-100 hover:text-ink-900',
                // marcador lateral na cor de destaque
                'before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-accent before:transition-transform before:duration-200',
                active ? 'before:scale-y-100' : 'before:scale-y-0',
              )}
            >
              <it.icon className="size-4 shrink-0 transition-colors group-hover:text-brand-600" />
              <span className="truncate">{it.label}</span>
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}

const GROUP_KEY = (title: string) => `secmulher.nav.${title}`

function readGroupPref(title: string): boolean | null {
  try {
    const v = localStorage.getItem(GROUP_KEY(title))
    return v === null ? null : v === '1'
  } catch {
    return null
  }
}

/**
 * Grupo expansível do menu (Financeiro, Frotas…). Abre sozinho quando a página atual
 * pertence a ele; fora isso, lembra se foi deixado aberto ou fechado.
 */
function NavGroup({
  title,
  icon: Icon,
  items,
  onNavigate,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
  onNavigate: () => void
}) {
  const { pathname } = useLocation()
  const containsActive = items.some((it) => isItemActive(it, pathname))
  const [open, setOpen] = useState(() => containsActive || (readGroupPref(title) ?? false))

  // navegou para uma página do grupo (ex.: por um link no meio da tela): abre
  useEffect(() => {
    if (containsActive) setOpen(true)
  }, [containsActive])

  if (items.length === 0) return null

  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(GROUP_KEY(title), v ? '0' : '1')
      } catch {
        /* sem armazenamento: só não lembra */
      }
      return !v
    })
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={clsx(
          'group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
          containsActive && !open
            ? 'bg-brand-50 font-medium text-brand-800'
            : containsActive
              ? 'font-medium text-ink-900'
              : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
        )}
      >
        <Icon className={clsx('size-4 shrink-0 transition-colors', containsActive ? 'text-brand-600' : 'group-hover:text-brand-600')} />
        <span className="flex-1 truncate text-left">{title}</span>
        <ChevronRight className={clsx('size-4 shrink-0 text-ink-400 transition-transform duration-200', open && 'rotate-90')} />
      </button>
      {/* grid-rows 0fr → 1fr anima a altura sem precisar medir o conteúdo */}
      <div
        className={clsx(
          'grid transition-[grid-template-rows,opacity] duration-250 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="mt-0.5 ml-[1.15rem] border-l border-ink-200 pl-2">
            <NavItems items={items} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppLayout() {
  const { user, isAdmin, mulheresAccess, financeAccess, fleetAccess, amendmentsAccess, tasksAccess, logout } = useAuth()
  const isDriver = useIsDriver()
  const categories = useCategories()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setOpen(false), [location.pathname])

  const main: NavItem[] = [{ to: '/', label: 'Painel', icon: LayoutDashboard, end: true }]
  if (mulheresAccess.canRead) main.push({ to: '/mulheres', label: 'Mulheres atendidas', icon: UsersRound })

  const cadastros: NavItem[] = (categories.data ?? [])
    .filter((c) => c.entityType === 'dynamic' && c.isActive)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((c) => ({ to: `/cadastros/${c.id}`, label: c.name, icon: FolderKanban }))

  const financeiro: NavItem[] = financeAccess.canRead
    ? [
        { to: '/financeiro', label: 'Ações e subações', icon: LayoutGrid, end: true, also: ['/financeiro/acoes', '/financeiro/subacoes'] },
        { to: '/financeiro/empenhos', label: 'Empenhos', icon: FileText },
        { to: '/financeiro/operacoes', label: 'Operações', icon: ArrowLeftRight },
      ]
    : []

  const frotas: NavItem[] = [
    ...(fleetAccess.canRead
      ? [
          { to: '/frotas', label: 'Agenda de viagens', icon: CalendarRange, end: true, also: ['/frotas/viagens'] },
          { to: '/frotas/motoristas', label: 'Motoristas', icon: IdCard },
          { to: '/frotas/veiculos', label: 'Veículos', icon: Car },
        ]
      : []),
    // o motorista vinculado vê a própria agenda mesmo sem permissão em Frotas
    ...(isDriver ? [{ to: '/frotas/minha-agenda', label: 'Minha agenda', icon: CalendarCheck2 }] : []),
  ]

  const emendas: NavItem[] = amendmentsAccess.canRead
    ? [
        { to: '/emendas', label: 'Acompanhamento', icon: ScrollText, except: ['/emendas/setores'] },
        { to: '/emendas/setores', label: 'Setores', icon: Building2 },
      ]
    : []

  const metas: NavItem[] = tasksAccess.canRead
    ? [
        { to: '/metas', label: 'Metas', icon: Target, except: ['/metas/tarefas', '/metas/quadro'] },
        { to: '/metas/quadro', label: 'Quadro', icon: KanbanSquare },
        { to: '/metas/tarefas', label: 'Tarefas', icon: ListChecks },
      ]
    : []

  const admin: NavItem[] = isAdmin
    ? [
        { to: '/admin/funcionarias', label: 'Funcionárias', icon: Users },
        { to: '/admin/categorias', label: 'Categorias e campos', icon: Settings2 },
        { to: '/admin/permissoes', label: 'Permissões', icon: ShieldCheck },
      ]
    : []

  const close = () => setOpen(false)

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <NavItems items={main} onNavigate={close} />
        <div className="mt-4 border-t border-ink-100 pt-3">
          <NavGroup title="Cadastros" icon={FolderKanban} items={cadastros} onNavigate={close} />
          <NavGroup title="Financeiro" icon={Wallet} items={financeiro} onNavigate={close} />
          <NavGroup title="Frotas" icon={CarFront} items={frotas} onNavigate={close} />
          <NavGroup title="Emendas" icon={Landmark} items={emendas} onNavigate={close} />
          <NavGroup title="Metas e tarefas" icon={Target} items={metas} onNavigate={close} />
          <NavGroup title="Administração" icon={SlidersHorizontal} items={admin} onNavigate={close} />
        </div>
      </div>
      <div className="border-t border-ink-200 p-3">
        <Link to="/perfil" className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-ink-100">
          <Avatar name={user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-800">{user?.name}</p>
            <p className="truncate text-xs text-ink-500">{isAdmin ? 'Administração' : 'Equipe'}</p>
          </div>
          <UserCircle2 className="size-4 text-ink-400" />
        </Link>
        <button
          onClick={logout}
          className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </div>
    </nav>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <TopProgressBar />
      <div className="sticky top-0 z-30">
        {/* Faixa institucional */}
        <div className="bg-institutional text-[11px] font-medium tracking-wider text-white/75 uppercase">
          <div className="flex h-7 items-center px-4 sm:px-6">Governo do Estado de Pernambuco</div>
        </div>

        <header className="border-b border-ink-200 bg-surface/85 backdrop-blur-md">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              className="-ml-1 rounded-lg p-1.5 text-ink-600 transition-colors hover:bg-ink-100 lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Abrir menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <Link to="/" className="group flex items-center gap-2.5">
              <BrandMark className="transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3" />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-brand-800">Secretaria da Mulher</p>
                <p className="hidden text-xs text-ink-500 sm:block">Sistema de Atendimento</p>
              </div>
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
            </div>
          </div>
        </header>
      </div>

      <div className="flex flex-1">
        <aside className="sticky top-[5.25rem] hidden h-[calc(100vh-5.25rem)] w-64 shrink-0 border-r border-ink-200 bg-surface lg:block">
          {sidebar}
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 animate-fade-in bg-overlay" onClick={close} />
            <aside className="absolute inset-y-0 left-0 w-72 animate-drawer-in bg-surface shadow-(--shadow-pop)">
              {sidebar}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          {/* key no caminho: cada página entra com um fade suave */}
          <div key={location.pathname} className="mx-auto max-w-7xl animate-fade-up px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
