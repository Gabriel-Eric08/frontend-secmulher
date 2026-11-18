import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowLeftRight,
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
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useCategories } from '@/queries/admin'
import { Avatar } from '@/components/ui/Layout'
import { BrandMark } from './BrandMark'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

function NavSection({ title, items, onNavigate }: { title?: string; items: NavItem[]; onNavigate: () => void }) {
  if (items.length === 0) return null
  return (
    <div className="mb-5">
      {title && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-ink-400 uppercase">{title}</p>}
      <ul className="space-y-0.5">
        {items.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              end={it.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-brand-50 font-medium text-brand-800'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                )
              }
            >
              <it.icon className="size-4 shrink-0" />
              <span className="truncate">{it.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AppLayout() {
  const { user, isAdmin, mulheresAccess, financeAccess, logout } = useAuth()
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
        { to: '/financeiro', label: 'Ações e subações', icon: Wallet, end: true },
        { to: '/financeiro/empenhos', label: 'Empenhos', icon: FileText },
        { to: '/financeiro/operacoes', label: 'Operações', icon: ArrowLeftRight },
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
        <NavSection items={main} onNavigate={close} />
        <NavSection title="Cadastros" items={cadastros} onNavigate={close} />
        <NavSection title="Financeiro" items={financeiro} onNavigate={close} />
        <NavSection title="Administração" items={admin} onNavigate={close} />
      </div>
      <div className="border-t border-ink-200 p-3">
        <Link to="/perfil" className="flex items-center gap-3 rounded-md p-2 hover:bg-ink-100">
          <Avatar name={user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-800">{user?.name}</p>
            <p className="truncate text-xs text-ink-500">{isAdmin ? 'Administração' : 'Equipe'}</p>
          </div>
          <UserCircle2 className="size-4 text-ink-400" />
        </Link>
        <button
          onClick={logout}
          className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-600 hover:bg-ink-100 hover:text-ink-900"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </div>
    </nav>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-30">
      {/* Faixa institucional */}
      <div className="bg-brand-900 text-[11px] font-medium tracking-wider text-brand-100 uppercase">
        <div className="flex h-7 items-center px-4 sm:px-6">Governo do Estado de Pernambuco</div>
      </div>

      <header className="border-b border-ink-200 bg-white">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <button
            className="-ml-1 rounded p-1.5 text-ink-600 hover:bg-ink-100 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Abrir menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-brand-800">Secretaria da Mulher</p>
              <p className="hidden text-xs text-ink-500 sm:block">Sistema de Atendimento</p>
            </div>
          </Link>
        </div>
      </header>
      </div>

      <div className="flex flex-1">
        <aside className="sticky top-[5.25rem] hidden h-[calc(100vh-5.25rem)] w-64 shrink-0 border-r border-ink-200 bg-white lg:block">
          {sidebar}
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-ink-900/30" onClick={close} />
            <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{sidebar}</aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
