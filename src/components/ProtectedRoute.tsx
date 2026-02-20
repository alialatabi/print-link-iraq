import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'customer' | 'designer' | 'admin';
}

/** Requires authentication. If requiredRole is set, also checks role (admin can access everything). */
const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    const currentPath = window.location.pathname + window.location.search;
    return <Navigate to={`/auth?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  if (requiredRole && role !== requiredRole && role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
