const runtimeEnv = typeof window !== 'undefined' && window._env_ ? window._env_ : {};
export const API_URL = runtimeEnv.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export const GENDER_CHOICES = {
  M: 'Masculino',
  F: 'Femenino',
  O: 'Otro',
};

export const USER_TYPES = {
  admin: 'Administrador',
  seller: 'Vendedor',
  customer: 'Cliente',
  supplier: 'Proveedor',
};
