import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import toast from 'react-hot-toast';

const PrivateRoute = ({ children, requiredPermissions = [], requiredRoles = [], requirePanel = false, allowedUserTypes = [] }) => {
  const { isAuthenticated, loading, metaLoading, hasAnyPermission, hasAnyRole, canAccessPanel, user, isSuperuser } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} />;
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
    toast.error('No tienes acceso al panel');
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-sm text-red-600">No autorizado</div>
      </div>
    );
  }

  if (allowedUserTypes.length > 0) {
    const userTypeAllowed = isSuperuser || (user && allowedUserTypes.includes(user.user_type));
    if (!userTypeAllowed) {
      toast.error('No tienes permisos para esta sección');
      return (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-sm text-red-600">No autorizado</div>
        </div>
      );
    }
  }

  if (requiredPermissions.length > 0 && !hasAnyPermission(requiredPermissions)) {
    toast.error('No cuentas con los permisos requeridos');
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-sm text-red-600">No autorizado</div>
      </div>
    );
  }

  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    toast.error('No cuentas con el rol requerido');
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="text-sm text-red-600">No autorizado</div>
      </div>
    );
  }

  return children;
};

export default PrivateRoute;
