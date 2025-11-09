import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/common/Header.jsx';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      gender: '',
      address: '',
    }
  });

  useEffect(() => {
    if (user) {
      reset({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        gender: user.gender || '',
        address: user.address || '',
      });
    }
  }, [user, reset]);

  const onSubmit = async (data) => {
    await updateUser(data);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white">
        {/* Navbar simple
        <nav className="border-b border-gray-900">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <button onClick={() => navigate('/')} className="border border-gray-900 px-3 py-1 text-sm">Inicio</button>
            <h1 className="text-base font-semibold">Perfil</h1>
          <div />
        </div>
        </nav> */}

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="border border-gray-900 p-6">
          <h2 className="text-lg font-medium mb-4">Configurar perfil</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Nombre</label>
              <input
                type="text"
                {...register('first_name')}
                className={`block w-full px-3 py-2 border rounded-none ${errors.first_name ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Apellido</label>
              <input
                type="text"
                {...register('last_name')}
                className={`block w-full px-3 py-2 border rounded-none ${errors.last_name ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Correo</label>
              <input
                type="email"
                {...register('email', { required: 'El correo es requerido' })}
                className={`block w-full px-3 py-2 border rounded-none ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm mb-1">Teléfono</label>
              <input
                type="text"
                {...register('phone')}
                className={`block w-full px-3 py-2 border rounded-none border-gray-300`}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Género</label>
              <select
                {...register('gender')}
                className="block w-full px-3 py-2 border rounded-none border-gray-300 bg-white"
              >
                <option value="">Sin especificar</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Dirección</label>
              <textarea
                rows="3"
                {...register('address')}
                className="block w-full px-3 py-2 border rounded-none border-gray-300"
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3 mt-2">
              <button type="button" onClick={() => navigate(-1)} className="btn-outline-slim">Cancelar</button>
              <button type="submit" disabled={isSubmitting} className="btn-outline-slim">
                {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </>
  );
};

export default Profile;
