import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SystemNavbar from '../components/system-components/system-navbar/SystemNavbar';
import FloatingCreateButton from '../components/system-components/FloatingCreateButton';

function AdminLayout(): React.ReactElement {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span>Loading...</span>
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SystemNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <FloatingCreateButton />
    </div>
  );
}

export default AdminLayout;
