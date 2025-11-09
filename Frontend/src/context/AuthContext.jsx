import { createContext, useState, useEffect, useContext } from 'react';
import authService from '../services/authService.js';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [isSuperuser, setIsSuperuser] = useState(false);

  useEffect(() => {
    // Verificar si hay un usuario en localStorage al cargar
    const storedUser = authService.getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
      // Cargar roles y permisos si hay token
      const access = localStorage.getItem('access_token');
      if (access) {
        loadAuthMeta();
      }
    }
    setLoading(false);
  }, []);

  const loadAuthMeta = async () => {
    try {
      setMetaLoading(true);
      const data = await authService.getAuthInfo();
      setRoles(Array.isArray(data.roles) ? data.roles : []);
      setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      // Si el backend expone superusuario
      setIsSuperuser(Boolean(data?.user?.is_superuser));
    } catch (e) {
      setRoles([]);
      setPermissions([]);
      setIsSuperuser(false);
    } finally {
      setMetaLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const data = await authService.login(credentials);
      setUser(data.user);
      toast.success(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{data.message || 'Login exitoso'}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
      await loadAuthMeta();
      return data;
    } catch (error) {
      const errorMsg = error.error || 'Error al iniciar sesión';
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const data = await authService.register(userData);
      setUser(data.user);
      toast.success(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{data.message || 'Registro exitoso'}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
      await loadAuthMeta();
      return data;
    } catch (error) {
      const errorMsg = error.error || 'Error al registrarse';
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setIsSuperuser(false);
      toast.success(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">Sesión cerrada exitosamente</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setUser(null);
    }
  };

  const updateUser = async (userData) => {
    try {
      const data = await authService.updateProfile(userData);
      setUser(data);
      toast.success(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">Perfil actualizado exitosamente</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
      return data;
    } catch (error) {
      const errorMsg = error.error || 'Error al actualizar perfil';
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="text-xs px-2 py-1 border border-gray-300 hover:bg-gray-100">Cerrar</button>
        </div>
      ));
      throw error;
    }
  };

  const value = {
    user,
    loading,
    metaLoading,
    roles,
    permissions,
    isSuperuser,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    hasPermission: (code) => permissions.includes(code) || isSuperuser,
    hasAnyPermission: (codes = []) => Boolean(isSuperuser || codes.some((c) => permissions.includes(c))),
    hasRole: (name) => roles.includes(name) || isSuperuser,
    hasAnyRole: (names = []) => Boolean(isSuperuser || names.some((n) => roles.includes(n))),
  // El panel ahora se controla por permiso explícito
  canAccessPanel: () => Boolean(isSuperuser || permissions.includes('panel.access')),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export default AuthContext;
