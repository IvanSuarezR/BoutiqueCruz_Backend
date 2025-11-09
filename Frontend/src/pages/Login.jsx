import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useForm } from 'react-hook-form';
import Header from '../components/common/Header.jsx';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await login(data);
      navigate('/');
    } catch (error) {
      console.error('Error en login:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-140px)]">
        <div className="w-full max-w-sm">
          <div className="mb-4 text-center">
            <h1 className="text-lg font-semibold tracking-wide">BoutiqueCruz</h1>
          </div>

          <div className="border border-gray-900 p-4 rounded-md shadow-sm">
            <h2 className="text-base font-medium">Ingresar</h2>
            <p className="text-xs text-gray-600 mb-3">Accede a tu cuenta</p>

            <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
              {/* Usuario o correo */}
              <div>
                <label htmlFor="username" className="block text-xs text-gray-700 mb-1">Usuario o Correo</label>
                <input
                  id="username"
                  type="text"
                  {...register('username', { required: 'Este campo es requerido' })}
                  className={`block w-full px-3 py-1.5 border rounded ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="usuario o correo@ejemplo.com" />
                {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>}
              </div>

              {/* Contraseña */}
              <div>
                <label htmlFor="password" className="block text-xs text-gray-700 mb-1">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  {...register('password', { required: 'La contraseña es requerida' })}
                  className={`block w-full px-3 py-1.5 border rounded ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="••••••••" />
                {errors.password && <p className="mt-1 text-[11px] text-red-600">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={isLoading} className="w-full btn-outline-slim py-2 text-sm">
                {isLoading ? 'Ingresando…' : 'Iniciar sesión'}
              </button>

              <p className="text-center text-xs text-gray-600">
                ¿No tienes cuenta? <Link to="/register" className="underline">Regístrate</Link>{' '}|{' '}
                <Link to="/" className="underline">Inicio</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
