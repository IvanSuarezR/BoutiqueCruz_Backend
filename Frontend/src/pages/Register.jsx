import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useForm } from 'react-hook-form';
import Header from '../components/common/Header.jsx';

const Register = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const password = watch('password');

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      // Registro corto: sólo usuario, correo y contraseña (backend genera otros campos)
      const email = (data.email || '').trim().toLowerCase();
      const username = (data.username || '').trim();

      const payload = {
        username,
        email,
        password: data.password,
        password2: data.password2,
      };

      await registerUser(payload);
      navigate('/');
    } catch (error) {
      console.error('Error en registro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-100px)]">
        <div className="w-full max-w-sm">
          <div className="mb-4 text-center">
            <h1 className="text-lg font-semibold tracking-wide">BoutiqueCruz</h1>
          </div>

  <div className="border border-gray-900 p-4 rounded-md shadow-sm">
    <h2 className="text-base font-medium">Crear cuenta</h2>
    <p className="text-xs text-gray-600 mb-3">Rápido y sencillo</p>

          <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
            {/* Usuario */}
            <div>
              <label htmlFor="username" className="block text-xs text-gray-700 mb-1">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                {...register('username', {
                  required: 'El usuario es requerido',
                  minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                })}
                className={`block w-full px-3 py-1.5 border rounded ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="ej: juanperez" />
              {errors.username && <p className="mt-1 text-[11px] text-red-600">{errors.username.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs text-gray-700 mb-1">Correo</label>
              <input
                id="email"
                type="email"
                {...register('email', {
                  required: 'El correo es requerido',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Correo inválido',
                  },
                })}
                className={`block w-full px-3 py-1.5 border rounded ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="correo@ejemplo.com" />
              {errors.email && <p className="mt-1 text-[11px] text-red-600">{errors.email.message}</p>}
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="password" className="block text-xs text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                {...register('password', {
                  required: 'La contraseña es requerida',
                  minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                })}
                className={`block w-full px-3 py-1.5 border rounded ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="••••••••" />
              {errors.password && <p className="mt-1 text-[11px] text-red-600">{errors.password.message}</p>}
            </div>

            {/* Confirmar */}
            <div>
              <label htmlFor="password2" className="block text-xs text-gray-700 mb-1">Confirmar contraseña</label>
              <input
                id="password2"
                type="password"
                {...register('password2', {
                  required: 'Confirma tu contraseña',
                  validate: (value) => value === password || 'Las contraseñas no coinciden',
                })}
                className={`block w-full px-3 py-1.5 border rounded ${errors.password2 ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="••••••••" />
              {errors.password2 && <p className="mt-1 text-[11px] text-red-600">{errors.password2.message}</p>}
            </div>

            <button type="submit" disabled={isLoading} className="w-full btn-outline-slim py-2 text-sm">
              {isLoading ? 'Registrando…' : 'Crear cuenta'}
            </button>

            <p className="text-center text-xs text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="underline">Inicia sesión</Link>
              {' '}o{' '}
              <Link to="/" className="underline">Volver al inicio</Link>
            </p>
          </form>
        </div>
      </div>
    </div></>
  );
};

export default Register;
