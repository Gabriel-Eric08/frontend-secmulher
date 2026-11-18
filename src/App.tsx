import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { RequireAdmin, RequireAuth } from '@/auth/guards'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PerfilPage } from '@/pages/PerfilPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { MulheresListPage } from '@/pages/mulheres/MulheresListPage'
import { MulherFormPage } from '@/pages/mulheres/MulherFormPage'
import { MulherDetailPage } from '@/pages/mulheres/MulherDetailPage'
import { CadastroListPage } from '@/pages/cadastros/CadastroListPage'
import { CadastroFormPage } from '@/pages/cadastros/CadastroFormPage'
import { CadastroDetailPage } from '@/pages/cadastros/CadastroDetailPage'
import { RegistroRedirect } from '@/pages/cadastros/RegistroRedirect'
import { FuncionariasPage } from '@/pages/admin/FuncionariasPage'
import { FuncionariaDetailPage } from '@/pages/admin/FuncionariaDetailPage'
import { CategoriasPage } from '@/pages/admin/CategoriasPage'
import { CamposPage } from '@/pages/admin/CamposPage'
import { PermissoesPage } from '@/pages/admin/PermissoesPage'
import { TiposRegistroPage } from '@/pages/admin/TiposRegistroPage'
import { FinanceiroPage } from '@/pages/financeiro/FinanceiroPage'
import { AcaoDetailPage } from '@/pages/financeiro/AcaoDetailPage'
import { SubacaoDetailPage } from '@/pages/financeiro/SubacaoDetailPage'
import { EmpenhosPage } from '@/pages/financeiro/EmpenhosPage'
import { EmpenhoDetailPage } from '@/pages/financeiro/EmpenhoDetailPage'
import { OperacoesPage } from '@/pages/financeiro/OperacoesPage'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'perfil', element: <PerfilPage /> },

          { path: 'mulheres', element: <MulheresListPage /> },
          { path: 'mulheres/nova', element: <MulherFormPage /> },
          { path: 'mulheres/:id', element: <MulherDetailPage /> },
          { path: 'mulheres/:id/editar', element: <MulherFormPage /> },

          { path: 'cadastros/:categoryId', element: <CadastroListPage /> },
          { path: 'cadastros/:categoryId/novo', element: <CadastroFormPage /> },
          { path: 'cadastros/:categoryId/:id', element: <CadastroDetailPage /> },
          { path: 'cadastros/:categoryId/:id/editar', element: <CadastroFormPage /> },
          { path: 'registros/:id', element: <RegistroRedirect /> },

          { path: 'financeiro', element: <FinanceiroPage /> },
          { path: 'financeiro/acoes/:id', element: <AcaoDetailPage /> },
          { path: 'financeiro/subacoes/:id', element: <SubacaoDetailPage /> },
          { path: 'financeiro/empenhos', element: <EmpenhosPage /> },
          { path: 'financeiro/empenhos/:id', element: <EmpenhoDetailPage /> },
          { path: 'financeiro/operacoes', element: <OperacoesPage /> },

          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [
              { path: 'funcionarias', element: <FuncionariasPage /> },
              { path: 'funcionarias/:id', element: <FuncionariaDetailPage /> },
              { path: 'categorias', element: <CategoriasPage /> },
              { path: 'categorias/:categoryId/campos', element: <CamposPage /> },
              { path: 'categorias/:categoryId/tipos', element: <TiposRegistroPage /> },
              { path: 'permissoes', element: <PermissoesPage /> },
            ],
          },

          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
