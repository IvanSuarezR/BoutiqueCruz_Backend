import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import UserMenu from '../components/common/UserMenu.jsx';
import logo from '../assets/boutiquecruz1.png';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="nav-slim">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer " onClick={() => navigate('/')}>  
              <img src={logo} alt="BoutiqueCruz" className="h-12 w-15 object-contain" />
              <h1 className="text-xl font-semibold tracking-wide select-none">BoutiqueCruz</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/')} className="btn-outline-slim">Inicio</button>
              <span className="text-gray-700 hidden sm:block">Bienvenido, <strong>{user?.first_name || user?.username}</strong></span>
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Tarjeta de bienvenida */}
          <div className="card-slim p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Panel de Control
            </h2>
            <p className="text-gray-600">
              Bienvenido al sistema de gestión de Boutique Fashion.
            </p>
          </div>

          {/* Información del usuario
          <div className="card-slim p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Información del Usuario
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nombre completo</p>
                <p className="text-gray-900 font-medium">
                  {user?.first_name} {user?.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900 font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">CI/NIT</p>
                <p className="text-gray-900 font-medium">{user?.identification_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tipo de usuario</p>
                <p className="text-gray-900 font-medium capitalize">
                  {user?.user_type === 'admin' && 'Administrador'}
                  {user?.user_type === 'seller' && 'Vendedor'}
                  {user?.user_type === 'customer' && 'Cliente'}
                  {user?.user_type === 'supplier' && 'Proveedor'}
                </p>
              </div>
              {user?.phone && (
                <div>
                  <p className="text-sm text-gray-500">Teléfono</p>
                  <p className="text-gray-900 font-medium">{user?.phone}</p>
                </div>
              )}
              {user?.address && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Dirección</p>
                  <p className="text-gray-900 font-medium">{user?.address}</p>
                </div>
              )}
            </div>
          </div> */}

          {/* Módulos del sistema */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Módulo Roles y Usuarios */}
            <div
              className="card-slim p-6 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => navigate('/admin/roles')}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Usuarios y Roles</h3>
                <svg
                  className="w-8 h-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Asignación de roles a usuarios</p>
            </div>

            {/* Módulo Inventario */}
            <div
              className="card-slim p-6 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => navigate('/inventory')}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Inventario</h3>
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Productos y categorías</p>
            </div>

            {/* Módulo Caja (POS) */}
            <div className="card-slim p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate('/pos')}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Caja (POS)</h3>
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Venta rápida en tienda</p>
            </div>

            {/* Módulo Ventas (Administración) */}
            <div className="card-slim p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate('/sales')}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Ventas</h3>
                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .843-3 1.882v8.236C9 19.157 10.343 20 12 20s3-.843 3-1.882V9.882C15 8.843 13.657 8 12 8z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8c-1.657 0-3 .843-3 1.882v4.236C3 15.157 4.343 16 6 16s3-.843 3-1.882V9.882C9 8.843 7.657 8 6 8zm12 0c-1.657 0-3 .843-3 1.882v4.236C15 15.157 16.343 16 18 16s3-.843 3-1.882V9.882C21 8.843 19.657 8 18 8z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Gestión y seguimiento de pedidos</p>
            </div>

            {/* Módulo Reportes */}
            <div className="card-slim p-6 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Reportes IA</h3>
                <svg
                  className="w-8 h-8 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Reportes inteligentes con IA</p>
            </div>

            {/* Módulo Predicción */}
            <div className="card-slim p-6 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Predicción ML</h3>
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Análisis predictivo de ventas</p>
            </div>

            {/* Módulo Configuración */}
            <div className="card-slim p-6 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Configuración</h3>
                <svg
                  className="w-8 h-8 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Configuración del sistema</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
