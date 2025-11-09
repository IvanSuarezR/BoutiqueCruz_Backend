import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const PrivateRoute = ({ children, requiredPermissions = [], requiredRoles = [], requirePanel = false, allowedUserTypes = [] }) => {
  const { isAuthenticated, loading, metaLoading, hasAnyPermission, hasAnyRole, canAccessPanel, user, isSuperuser } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  // Esperar metadatos si se requieren reglas
  if ((requirePanel || requiredPermissions.length > 0 || requiredRoles.length > 0) && metaLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (requirePanel && !canAccessPanel()) {
    return <Navigate to="/" />;
  }

  if (allowedUserTypes.length > 0) {
    const userTypeAllowed = isSuperuser || (user && allowedUserTypes.includes(user.user_type));
    if (!userTypeAllowed) return <Navigate to="/" />;
  }

  if (requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
    return <Navigate to="/" />;
  }

  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return <Navigate to="/" />;
  }

  return children;
};

export default PrivateRoute;
