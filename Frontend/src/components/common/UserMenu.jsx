import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const UserMenu = ({ className = 'btn-outline-slim' }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    await logout();
    // Recarga la misma página. Si es privada, PrivateRoute redirigirá.
    navigate(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={className}
        title={user?.username || 'Perfil'}
      >
        {/* Icono persona minimal */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M12 12a5 5 0 100-10 5 5 0 000 10z" />
          <path fillRule="evenodd" d="M.458 20.042A11.955 11.955 0 0112 18c4.295 0 8.084 2.25 10.542 5.658a.75.75 0 11-1.2.888A10.455 10.455 0 0012 19.5c-3.49 0-6.628 1.675-8.342 4.046a.75.75 0 11-1.2-.888z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-900 z-50">
          <div className="px-3 py-2 text-xs text-gray-600 border-b border-gray-200 truncate">
            {user?.first_name || user?.username}
          </div>
          <button
            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
            onClick={() => { setOpen(false); navigate('/profile'); }}
          >
            Configurar perfil
          </button>
          <button
            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-t border-gray-200"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
