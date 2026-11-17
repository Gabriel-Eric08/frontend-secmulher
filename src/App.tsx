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

          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [
              { path: 'funcionarias', element: <FuncionariasPage /> },
              { path: 'funcionarias/:id', element: <FuncionariaDetailPage /> },
              { path: 'categorias', element: <CategoriasPage /> },
              { path: 'categorias/:categoryId/campos', element: <CamposPage /> },
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
