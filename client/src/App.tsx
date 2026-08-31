import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import ProtectedLayout from './layouts/ProtectedLayout';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/system-page/LoginPage';
import DashboardPage from './pages/system-page/DashboardPage';
import TicketListPage from './pages/system-page/TicketListPage';
import TicketDetailPage from './pages/system-page/TicketDetailPage';
import CreateTicketPage from './pages/system-page/CreateTicketPage';
import UserListPage from './pages/admin-pages/UserListPage';
import CreateUserPage from './pages/admin-pages/CreateUserPage';
import EditUserPage from './pages/admin-pages/EditUserPage';

const router = createBrowserRouter([
  // Root redirect
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  // Public routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  // Protected routes (any authenticated user)
  {
    element: <ProtectedLayout />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/tickets', element: <TicketListPage /> },
      { path: '/tickets/new', element: <CreateTicketPage /> },
      { path: '/tickets/:id', element: <TicketDetailPage /> },
    ],
  },
  // Admin-only routes
  {
    element: <AdminLayout />,
    children: [
      { path: '/admin/users', element: <UserListPage /> },
      { path: '/admin/users/new', element: <CreateUserPage /> },
      { path: '/admin/users/:id', element: <EditUserPage /> },
    ],
  },
]);

function App(): React.ReactElement {
  return <RouterProvider router={router} />;
}

export default App;
