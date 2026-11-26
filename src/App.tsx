import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { RequireAdmin, RequireAuth } from '@/auth/guards'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PerfilPage } from '@/pages/PerfilPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouteErrorPage } from '@/pages/RouteErrorPage'
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
import { AgendaPage } from '@/pages/frotas/AgendaPage'
import { TripFormPage } from '@/pages/frotas/TripFormPage'
import { TripDetailPage } from '@/pages/frotas/TripDetailPage'
import { MotoristasPage } from '@/pages/frotas/MotoristasPage'
import { MotoristaDetailPage } from '@/pages/frotas/MotoristaDetailPage'
import { VeiculosPage } from '@/pages/frotas/VeiculosPage'
import { VeiculoDetailPage } from '@/pages/frotas/VeiculoDetailPage'
import { MinhaAgendaPage } from '@/pages/frotas/MinhaAgendaPage'
import { EmendasPage } from '@/pages/emendas/EmendasPage'
import { EmendaDetailPage } from '@/pages/emendas/EmendaDetailPage'
import { EmendaFormPage } from '@/pages/emendas/EmendaFormPage'
import { SetoresPage } from '@/pages/emendas/SetoresPage'
import { MetasPage } from '@/pages/metas/MetasPage'
import { MetaDetailPage } from '@/pages/metas/MetaDetailPage'
import { TarefasPage } from '@/pages/metas/TarefasPage'
import { TarefaDetailPage } from '@/pages/metas/TarefaDetailPage'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorPage fullScreen /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage fullScreen />,
    children: [
      {
        element: <AppLayout />,
        // erro numa página mantém o menu e o cabeçalho
        children: [{ errorElement: <RouteErrorPage />, children: [
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

          { path: 'frotas', element: <AgendaPage /> },
          { path: 'frotas/minha-agenda', element: <MinhaAgendaPage /> },
          { path: 'frotas/viagens/nova', element: <TripFormPage /> },
          { path: 'frotas/viagens/:id', element: <TripDetailPage /> },
          { path: 'frotas/viagens/:id/editar', element: <TripFormPage /> },
          { path: 'frotas/motoristas', element: <MotoristasPage /> },
          { path: 'frotas/motoristas/:id', element: <MotoristaDetailPage /> },
          { path: 'frotas/veiculos', element: <VeiculosPage /> },
          { path: 'frotas/veiculos/:id', element: <VeiculoDetailPage /> },

          { path: 'emendas', element: <EmendasPage /> },
          { path: 'emendas/nova', element: <EmendaFormPage /> },
          { path: 'emendas/setores', element: <SetoresPage /> },
          { path: 'emendas/:id', element: <EmendaDetailPage /> },
          { path: 'emendas/:id/editar', element: <EmendaFormPage /> },

          { path: 'metas', element: <MetasPage /> },
          { path: 'metas/tarefas', element: <TarefasPage /> },
          { path: 'metas/tarefas/:id', element: <TarefaDetailPage /> },
          { path: 'metas/:id', element: <MetaDetailPage /> },

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
        ] }],
      },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
