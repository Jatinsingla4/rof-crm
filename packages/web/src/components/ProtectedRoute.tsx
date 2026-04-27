import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermission?: string;
}

/**
 * ProtectedRoute - Enforces authentication and RBAC
 * Redirects to login if not authenticated
 * Redirects to dashboard if role/permission missing
 */
export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
}: ProtectedRouteProps) {
  const { user, permissions } = useAuthStore();

  // Check authentication
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role if required
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // Check permission if required
  if (requiredPermission && !permissions.includes(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
