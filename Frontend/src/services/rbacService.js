import axiosInstance from './axiosConfig.js';

const unwrap = (data) => (Array.isArray(data) ? data : (data?.results ?? data));

const rbacService = {
  // Roles
  getRoles: async () => {
    const res = await axiosInstance.get('/auth/roles/');
    return unwrap(res.data);
  },
  getRole: async (roleId) => {
    const res = await axiosInstance.get(`/auth/roles/${roleId}/`);
    return res.data;
  },
  createRole: async (payload) => {
    const res = await axiosInstance.post('/auth/roles/', payload);
    return res.data;
  },
  updateRole: async (roleId, payload) => {
    const res = await axiosInstance.patch(`/auth/roles/${roleId}/`, payload);
    return res.data;
  },
  deleteRole: async (roleId) => {
    const res = await axiosInstance.delete(`/auth/roles/${roleId}/`);
    return res.data;
  },
  assignUsersToRole: async (roleId, userIds) => {
    const res = await axiosInstance.post(`/auth/roles/${roleId}/assign-users/`, {
      user_ids: userIds,
    });
    return res.data;
  },
  revokeUsersFromRole: async (roleId, userIds) => {
    const res = await axiosInstance.post(`/auth/roles/${roleId}/revoke-users/`, {
      user_ids: userIds,
    });
    return res.data;
  },

  // Permissions (opcionalmente para futuras pantallas)
  getPermissions: async () => {
    const res = await axiosInstance.get('/auth/permissions/');
    return unwrap(res.data);
  },

  grantPermissionsToRole: async (roleId, permissionIds) => {
    const res = await axiosInstance.post(`/auth/roles/${roleId}/grant-permissions/`, {
      permission_ids: permissionIds,
    });
    return res.data;
  },

  revokePermissionsFromRole: async (roleId, permissionIds) => {
    const res = await axiosInstance.post(`/auth/roles/${roleId}/revoke-permissions/`, {
      permission_ids: permissionIds,
    });
    return res.data;
  },

  // Users
  getUsers: async () => {
    const res = await axiosInstance.get('/auth/users/');
    return unwrap(res.data);
  },
  getUsersPage: async (page = 1) => {
    const res = await axiosInstance.get('/auth/users/', { params: { page } });
    return res.data; // {count, next, previous, results}
  },
  createUser: async (payload) => {
    const res = await axiosInstance.post('/auth/users/', payload);
    return res.data;
  },
  getUser: async (userId) => {
    const res = await axiosInstance.get(`/auth/users/${userId}/`);
    return res.data;
  },
  updateUser: async (userId, payload) => {
    const res = await axiosInstance.patch(`/auth/users/${userId}/`, payload);
    return res.data;
  },
  deleteUser: async (userId) => {
    const res = await axiosInstance.delete(`/auth/users/${userId}/`);
    return res.data;
  },
  setUserPassword: async (userId, new_password, new_password2) => {
    const res = await axiosInstance.post(`/auth/users/${userId}/set-password/`, { new_password, new_password2 });
    return res.data;
  },
};

export default rbacService;
