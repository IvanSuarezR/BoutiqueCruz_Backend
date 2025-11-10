import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import rbacService from '../../services/rbacService.js';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext.jsx';

const Roles = () => {
  const navigate = useNavigate();
  const { canAccessPanel } = useAuth();

  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);

  const [roleSearch, setRoleSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [permSearch, setPermSearch] = useState('');

  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [tab, setTab] = useState('usuarios'); // usuarios | permisos

  // Selections
  const [selectedAvailableUsers, setSelectedAvailableUsers] = useState([]);
  const [selectedAssignedUsers, setSelectedAssignedUsers] = useState([]);
  const [selectedGrantPerms, setSelectedGrantPerms] = useState([]);
  const [selectedRevokePerms, setSelectedRevokePerms] = useState([]);

  // Role modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });

  // User modal state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '', first_name: '', last_name: '', email: '',
    identification_number: '', phone: '', gender: '', address: '', is_active: true,
    user_type: '',
  });
  const [pwdForm, setPwdForm] = useState({ new_password: '', new_password2: '' });

  // Create user modal state
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password2: '',
  });
  // Roles selection state for modals
  const [editUserRoleId, setEditUserRoleId] = useState(null);
  const [createUserRoleId, setCreateUserRoleId] = useState(null);
  const [isEditRolesOpen, setIsEditRolesOpen] = useState(false);
  const [isCreateRolesOpen, setIsCreateRolesOpen] = useState(false);
  const editRolesRef = useRef(null);
  const createRolesRef = useRef(null);

  const [userPage, setUserPage] = useState(1);
  const [userCount, setUserCount] = useState(0);
  const pageSize = 10; // keep in sync with DRF PAGE_SIZE
  const totalPages = useMemo(() => Math.max(1, Math.ceil(userCount / pageSize)), [userCount]);

  const fetchAll = async (page = 1) => {
    try {
      setLoading(true);
      const [rolesData, usersPageData, permsData] = await Promise.all([
        rbacService.getRoles(),
        rbacService.getUsersPage(page),
        rbacService.getPermissions(),
      ]);
      setRoles(rolesData);
      setUsers(usersPageData.results || []);
      setUserCount(usersPageData.count || (usersPageData.results ? usersPageData.results.length : 0));
      setUserPage(page);
      setPermissions(permsData);
      if (!selectedRoleId && rolesData.length > 0) {
        setSelectedRoleId(rolesData[0].id);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.detail || 'Error cargando datos de RBAC';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click-away handler for role dropdowns
  useEffect(() => {
    const handleClickAway = (e) => {
      if (isEditRolesOpen && editRolesRef.current && !editRolesRef.current.contains(e.target)) {
        setIsEditRolesOpen(false);
      }
      if (isCreateRolesOpen && createRolesRef.current && !createRolesRef.current.contains(e.target)) {
        setIsCreateRolesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [isEditRolesOpen, isCreateRolesOpen]);

  // Global Escape key to close any open modal/dropdown
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isRoleModalOpen) setIsRoleModalOpen(false);
        if (isUserModalOpen) setIsUserModalOpen(false);
        if (isCreateUserModalOpen) setIsCreateUserModalOpen(false);
        if (isEditRolesOpen) setIsEditRolesOpen(false);
        if (isCreateRolesOpen) setIsCreateRolesOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isRoleModalOpen, isUserModalOpen, isCreateUserModalOpen, isEditRolesOpen, isCreateRolesOpen]);

  const selectedRole = useMemo(() => roles.find(r => r.id === selectedRoleId) || null, [roles, selectedRoleId]);
  const filteredRoles = useMemo(() => roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase())), [roles, roleSearch]);

  const assignedUsers = useMemo(() => {
    if (!selectedRoleId) return [];
    return users.filter(u => Array.isArray(u.role_ids) && u.role_ids.includes(selectedRoleId));
  }, [users, selectedRoleId]);

  const availableUsers = useMemo(() => {
    const assignedIds = new Set(assignedUsers.map(u => u.id));
    const list = users.filter(u => !assignedIds.has(u.id));
    if (!userSearch) return list;
    const q = userSearch.toLowerCase();
    return list.filter(u => `${u.first_name} ${u.last_name} ${u.username} ${u.email}`.toLowerCase().includes(q));
  }, [users, assignedUsers, userSearch]);

  const assignedUsersFiltered = useMemo(() => {
    if (!userSearch) return assignedUsers;
    const q = userSearch.toLowerCase();
    return assignedUsers.filter(u => `${u.first_name} ${u.last_name} ${u.username} ${u.email}`.toLowerCase().includes(q));
  }, [assignedUsers, userSearch]);

  const assignedPermIds = new Set((selectedRole?.permissions || []).map(p => p.id));
  const availablePerms = useMemo(() => permissions.filter(p => !assignedPermIds.has(p.id)), [permissions, assignedPermIds]);
  const assignedPerms = useMemo(() => permissions.filter(p => assignedPermIds.has(p.id)), [permissions, assignedPermIds]);
  const availablePermsFiltered = useMemo(() => {
    if (!permSearch) return availablePerms;
    const q = permSearch.toLowerCase();
    return availablePerms.filter(p => `${p.code} ${p.name}`.toLowerCase().includes(q));
  }, [availablePerms, permSearch]);
  const assignedPermsFiltered = useMemo(() => {
    if (!permSearch) return assignedPerms;
    const q = permSearch.toLowerCase();
    return assignedPerms.filter(p => `${p.code} ${p.name}`.toLowerCase().includes(q));
  }, [assignedPerms, permSearch]);

  // Assign/Revoke Users
  const handleAssignUsers = async () => {
    if (!selectedRoleId || selectedAvailableUsers.length === 0) return;
    try {
      await rbacService.assignUsersToRole(selectedRoleId, selectedAvailableUsers);
      toast.success('Usuarios asignados');
  const upd = await rbacService.getUsersPage(userPage);
  setUsers(upd.results || []);
  setUserCount(upd.count || (upd.results ? upd.results.length : 0));
      setSelectedAvailableUsers([]);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'No se pudo asignar usuarios';
      toast.error(msg);
    }
  };
  const handleRevokeUsers = async () => {
    if (!selectedRoleId || selectedAssignedUsers.length === 0) return;
    try {
      await rbacService.revokeUsersFromRole(selectedRoleId, selectedAssignedUsers);
      toast.success('Usuarios removidos');
  const upd = await rbacService.getUsersPage(userPage);
  setUsers(upd.results || []);
  setUserCount(upd.count || (upd.results ? upd.results.length : 0));
      setSelectedAssignedUsers([]);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'No se pudo remover usuarios';
      toast.error(msg);
    }
  };

  // Grant/Revoke Permissions
  const handleGrantPerms = async () => {
    if (!selectedRoleId || selectedGrantPerms.length === 0) return;
    try {
      await rbacService.grantPermissionsToRole(selectedRoleId, selectedGrantPerms);
      toast.success('Permisos asignados');
      const freshRoles = await rbacService.getRoles();
      setRoles(freshRoles);
      setSelectedGrantPerms([]);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'No se pudo asignar permisos';
      toast.error(msg);
    }
  };
  const handleRevokePerms = async () => {
    if (!selectedRoleId || selectedRevokePerms.length === 0) return;
    try {
      await rbacService.revokePermissionsFromRole(selectedRoleId, selectedRevokePerms);
      toast.success('Permisos revocados');
      const freshRoles = await rbacService.getRoles();
      setRoles(freshRoles);
      setSelectedRevokePerms([]);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || 'No se pudo revocar permisos';
      toast.error(msg);
    }
  };

  // Role CRUD
  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '' });
    setIsRoleModalOpen(true);
  };
  const openEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({ name: role.name, description: role.description || '' });
    setIsRoleModalOpen(true);
  };
  const saveRole = async () => {
    try {
      if (editingRole) {
        await rbacService.updateRole(editingRole.id, roleForm);
        toast.success('Rol actualizado');
      } else {
        await rbacService.createRole(roleForm);
        toast.success('Rol creado');
      }
      const fresh = await rbacService.getRoles();
      setRoles(fresh);
      setIsRoleModalOpen(false);
      // Seleccionar el recién creado o mantener el actual
      if (!editingRole) {
        const created = fresh.find(r => r.name === roleForm.name);
        if (created) setSelectedRoleId(created.id);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.name?.[0] || 'No se pudo guardar el rol';
      toast.error(msg);
    }
  };
  const deleteRole = async (roleId) => {
    if (!confirm('¿Eliminar este rol? Esta acción no se puede deshacer.')) return;
    try {
      await rbacService.deleteRole(roleId);
      toast.success('Rol eliminado');
      const fresh = await rbacService.getRoles();
      setRoles(fresh);
      if (selectedRoleId === roleId) setSelectedRoleId(fresh[0]?.id || null);
    } catch (err) {
      const msg = err?.response?.data?.detail || 'No se pudo eliminar el rol';
      toast.error(msg);
    }
  };

  // User CRUD helpers
  const openCreateUser = () => {
    setCreateUserForm({ username: '', email: '', first_name: '', last_name: '', password: '', password2: '' });
    // Preseleccionar rol "Cliente" si existe
    const cliente = roles.find(r => (r.name || '').toLowerCase() === 'cliente' || (r.name || '').toLowerCase() === 'customer');
    setCreateUserRoleId(cliente ? cliente.id : null);
    setIsCreateUserModalOpen(true);
  };

  const openEditUser = async (userId) => {
    try {
      const data = await rbacService.getUser(userId);
      setEditingUser(data);
      setUserForm({
        username: data.username || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        identification_number: data.identification_number || '',
        phone: data.phone || '',
        gender: data.gender || '',
        address: data.address || '',
        is_active: !!data.is_active,
        user_type: data.user_type || '',
      });
  // Si el usuario tiene múltiples roles, seleccionamos el primero para estandarizar a uno solo
  const roleIds = Array.isArray(data.role_ids) ? data.role_ids : [];
  setEditUserRoleId(roleIds.length ? roleIds[0] : null);
      setPwdForm({ new_password: '', new_password2: '' });
      setIsUserModalOpen(true);
    } catch (err) {
      const msg = err?.response?.data?.detail || 'No se pudo cargar el usuario';
      toast.error(msg);
    }
  };

  const saveUserEdit = async () => {
    if (!editingUser) return;
    try {
      const payload = { ...userForm };
      // no enviar user_type desde aquí
      delete payload.user_type;
      const updated = await rbacService.updateUser(editingUser.id, payload);
      // Sincronizar rol único desde el modal
      const current = Array.isArray(editingUser.role_ids) ? editingUser.role_ids : [];
      const desired = editUserRoleId ? [editUserRoleId] : [];
      const toAssign = desired.filter(id => !current.includes(id));
      const toRevoke = current.filter(id => !desired.includes(id));
      const promises = [];
      toAssign.forEach(roleId => {
        promises.push(rbacService.assignUsersToRole(roleId, [editingUser.id]));
      });
      toRevoke.forEach(roleId => {
        promises.push(rbacService.revokeUsersFromRole(roleId, [editingUser.id]));
      });
      if (promises.length) {
        await Promise.all(promises);
      }
      toast.success('Usuario actualizado');
      // refrescar lista de usuarios
  const upd = await rbacService.getUsersPage(userPage);
  setUsers(upd.results || []);
  setUserCount(upd.count || (upd.results ? upd.results.length : 0));
      setIsUserModalOpen(false);
    } catch (err) {
      const errors = err?.response?.data || {};
      const msg = errors.detail || errors.email?.[0] || errors.identification_number?.[0] || 'No se pudo actualizar el usuario';
      toast.error(msg);
    }
  };

  const saveUserPassword = async () => {
    if (!editingUser) return;
    try {
      await rbacService.setUserPassword(editingUser.id, pwdForm.new_password, pwdForm.new_password2);
      toast.success('Contraseña actualizada');
      setPwdForm({ new_password: '', new_password2: '' });
    } catch (err) {
      const errors = err?.response?.data || {};
      const msg = errors.detail || errors.new_password?.[0] || 'No se pudo actualizar la contraseña';
      toast.error(msg);
    }
  };

  const deleteUser = async () => {
    if (!editingUser) return;
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    try {
      await rbacService.deleteUser(editingUser.id);
      toast.success('Usuario eliminado');
  const upd = await rbacService.getUsersPage(userPage);
  setUsers(upd.results || []);
  setUserCount(upd.count || (upd.results ? upd.results.length : 0));
      setIsUserModalOpen(false);
      // limpiar selecciones si correspondía
      setSelectedAvailableUsers(prev => prev.filter(id => id !== editingUser.id));
      setSelectedAssignedUsers(prev => prev.filter(id => id !== editingUser.id));
    } catch (err) {
      const msg = err?.response?.data?.detail || 'No se pudo eliminar el usuario';
      toast.error(msg);
    }
  };

  const submitCreateUser = async () => {
    try {
      const newUser = await rbacService.createUser(createUserForm);
      // Asignar rol seleccionado (si hay)
      if (newUser?.id && createUserRoleId) {
        await rbacService.assignUsersToRole(createUserRoleId, [newUser.id]);
        // Si se asignó un rol distinto de 'Cliente', remover el rol 'Cliente' por defecto para no duplicar
        const cliente = roles.find(r => (r.name || '').toLowerCase() === 'cliente' || (r.name || '').toLowerCase() === 'customer');
        if (cliente && cliente.id !== createUserRoleId) {
          try {
            await rbacService.revokeUsersFromRole(cliente.id, [newUser.id]);
          } catch(_){/* silencioso */}
        }
      }
      toast.success('Usuario creado');
      setIsCreateUserModalOpen(false);
      // refresh current page
      const upd = await rbacService.getUsersPage(userPage);
      setUsers(upd.results || []);
      setUserCount(upd.count || (upd.results ? upd.results.length : 0));
    } catch (err) {
      const errors = err?.response?.data || {};
      const msg = errors.detail || errors.username?.[0] || errors.email?.[0] || errors.password?.[0] || 'No se pudo crear el usuario';
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="nav-slim">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Usuarios y Roles</h1>
          <div className="space-x-2">
            <button className="btn-outline-slim" onClick={() => navigate('/')}>Inicio</button>
            {/* Botón Panel condicionado por permiso panel.access */}
            {canAccessPanel && canAccessPanel() && (
              <button className="btn-outline-slim" onClick={() => navigate('/dashboard')}>Panel</button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sidebar Roles */}
        <aside className="card-slim p-4 md:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Roles</h2>
            <button className="btn btn-primary" onClick={openCreateRole}>Nuevo</button>
          </div>
          <input
            className="w-full mb-3 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            placeholder="Buscar rol..."
            value={roleSearch}
            onChange={(e) => setRoleSearch(e.target.value)}
          />
          <div className="divide-y border border-gray-200 max-h-[28rem] overflow-auto">
            {filteredRoles.map(r => (
              <div key={r.id} className={`p-2 flex items-center justify-between cursor-pointer ${selectedRoleId === r.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => { setSelectedRoleId(r.id); setTab('usuarios'); }}>
                <div>
                  <div className="text-sm font-medium text-gray-900">{r.name}</div>
                  {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                </div>
                <div className="flex gap-1">
                  <button className="btn-outline-slim" onClick={(e) => { e.stopPropagation(); openEditRole(r); }}>Editar</button>
                  <button className="btn-outline-slim" onClick={(e) => { e.stopPropagation(); deleteRole(r.id); }}>Eliminar</button>
                </div>
              </div>
            ))}
            {filteredRoles.length === 0 && (
              <div className="p-3 text-sm text-gray-500">Sin resultados</div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <section className="md:col-span-2 space-y-4">
          {/* Role header */}
          {selectedRole && (
            <div className="card-slim p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedRole.name}</h2>
                  {selectedRole.description && <p className="text-sm text-gray-500">{selectedRole.description}</p>}
                </div>
                <div className="space-x-2">
                  <button className="btn-outline-slim" onClick={() => openEditRole(selectedRole)}>Editar</button>
                </div>
              </div>
              <div className="mt-4 border-b border-gray-200">
                <nav className="-mb-px flex gap-6">
                  {['usuarios','permisos'].map(t => (
                    <button key={t} className={`pb-2 text-sm ${tab===t?'border-b-2 border-blue-600 text-blue-600':'text-gray-600 hover:text-gray-900'}`} onClick={() => setTab(t)}>
                      {t === 'usuarios' ? 'Usuarios' : 'Permisos'}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          )}

          {/* Tab content */}
          {tab === 'usuarios' && (
            <div className="card-slim p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Buscar usuarios por nombre, usuario o email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <button className="btn btn-primary" onClick={openCreateUser}>Nuevo Usuario</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Disponibles */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Disponibles</h3>
                  <div className="border border-gray-200 max-h-96 overflow-auto divide-y">
                    {availableUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-50">
                        <input type="checkbox" className="h-4 w-4" checked={selectedAvailableUsers.includes(u.id)} onChange={(e)=>{
                          const c = e.target.checked; setSelectedAvailableUsers(prev=> c?[...prev,u.id]:prev.filter(id=>id!==u.id));
                        }} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name} <span className="text-gray-500">(@{u.username})</span></div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                        <div className="ml-auto">
                          <button className="btn-outline-slim" title="Editar" onClick={(e)=>{ e.preventDefault(); openEditUser(u.id); }}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-9.9 9.9a2 2 0 01-.878.515l-3.18.795a.5.5 0 01-.606-.606l.795-3.18a2 2 0 01.515-.878l9.9-9.9z" />
                            </svg>
                          </button>
                        </div>
                      </label>
                    ))}
                    {availableUsers.length === 0 && <div className="p-3 text-sm text-gray-500">No hay usuarios disponibles.</div>}
                  </div>
                </div>
                {/* Asignados */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Asignados</h3>
                  <div className="border border-gray-200 max-h-96 overflow-auto divide-y">
                    {assignedUsersFiltered.map(u => (
                      <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-50">
                        <input type="checkbox" className="h-4 w-4" checked={selectedAssignedUsers.includes(u.id)} onChange={(e)=>{
                          const c = e.target.checked; setSelectedAssignedUsers(prev=> c?[...prev,u.id]:prev.filter(id=>id!==u.id));
                        }} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name} <span className="text-gray-500">(@{u.username})</span></div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                        <div className="ml-auto">
                          <button className="btn-outline-slim" title="Editar" onClick={(e)=>{ e.preventDefault(); openEditUser(u.id); }}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-9.9 9.9a2 2 0 01-.878.515l-3.18.795a.5.5 0 01-.606-.606l.795-3.18a2 2 0 01.515-.878l9.9-9.9z" />
                            </svg>
                          </button>
                        </div>
                      </label>
                    ))}
                    {assignedUsersFiltered.length === 0 && <div className="p-3 text-sm text-gray-500">No hay usuarios asignados.</div>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button className="btn btn-primary" disabled={!selectedRoleId || selectedAvailableUsers.length===0} onClick={handleAssignUsers}>Asignar</button>
                <button className="btn btn-secondary" disabled={!selectedRoleId || selectedAssignedUsers.length===0} onClick={handleRevokeUsers}>Remover</button>
              </div>
              <div className="flex items-center justify-between mt-4 text-sm">
                <div>Usuarios: página {userPage} de {totalPages}</div>
                <div className="flex gap-2">
                  <button className="btn-outline-slim" disabled={userPage<=1} onClick={()=> fetchAll(userPage-1)}>Anterior</button>
                  <button className="btn-outline-slim" disabled={userPage>=totalPages} onClick={()=> fetchAll(userPage+1)}>Siguiente</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'permisos' && (
            <div className="card-slim p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Buscar permisos..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Disponibles */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Disponibles</h3>
                  <div className="border border-gray-200 max-h-96 overflow-auto divide-y">
                    {availablePermsFiltered.map(p => (
                      <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-gray-50">
                        <input type="checkbox" className="h-4 w-4" checked={selectedGrantPerms.includes(p.id)} onChange={(e)=>{
                          const c = e.target.checked; setSelectedGrantPerms(prev=> c?[...prev,p.id]:prev.filter(id=>id!==p.id));
                        }} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.code}</div>
                        </div>
                      </label>
                    ))}
                    {availablePermsFiltered.length === 0 && <div className="p-3 text-sm text-gray-500">Sin permisos disponibles.</div>}
                  </div>
                </div>
                {/* Asignados */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Asignados</h3>
                  <div className="border border-gray-200 max-h-96 overflow-auto divide-y">
                    {assignedPermsFiltered.map(p => (
                      <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-gray-50">
                        <input type="checkbox" className="h-4 w-4" checked={selectedRevokePerms.includes(p.id)} onChange={(e)=>{
                          const c = e.target.checked; setSelectedRevokePerms(prev=> c?[...prev,p.id]:prev.filter(id=>id!==p.id));
                        }} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.code}</div>
                        </div>
                      </label>
                    ))}
                    {assignedPermsFiltered.length === 0 && <div className="p-3 text-sm text-gray-500">Este rol no tiene permisos.</div>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button className="btn btn-primary" disabled={!selectedRoleId || selectedGrantPerms.length===0} onClick={handleGrantPerms}>Asignar permisos</button>
                <button className="btn btn-secondary" disabled={!selectedRoleId || selectedRevokePerms.length===0} onClick={handleRevokePerms}>Revocar permisos</button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Role Modal */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 bg-black/30 p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-md mx-auto rounded shadow p-4 relative flex flex-col max-h-[90vh]">
            <button
              aria-label="Cerrar"
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setIsRoleModalOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="mb-3">
              <h3 className="text-lg font-semibold">{editingRole ? 'Editar rol' : 'Nuevo rol'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-700">Nombre</label>
                  <input className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500" value={roleForm.name} onChange={(e)=> setRoleForm(prev=> ({...prev, name: e.target.value}))} />
                </div>
                <div>
                  <label className="text-sm text-gray-700">Descripción</label>
                  <textarea className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500" rows={3} value={roleForm.description} onChange={(e)=> setRoleForm(prev=> ({...prev, description: e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-outline-slim" onClick={()=> setIsRoleModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveRole}>{editingRole ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black/30 p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl mx-auto rounded shadow p-4 relative flex flex-col max-h-[90vh]">
            <button
              aria-label="Cerrar"
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setIsUserModalOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <h3 className="text-lg font-semibold mb-3">Editar usuario</h3>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-700">Usuario</label>
                <input className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={userForm.username} onChange={(e)=> setUserForm(prev=> ({...prev, username: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Email</label>
                <input className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={userForm.email} onChange={(e)=> setUserForm(prev=> ({...prev, email: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Nombre</label>
                <input className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={userForm.first_name} onChange={(e)=> setUserForm(prev=> ({...prev, first_name: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Apellido</label>
                <input className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={userForm.last_name} onChange={(e)=> setUserForm(prev=> ({...prev, last_name: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Identificación</label>
                <input className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={userForm.identification_number} onChange={(e)=> setUserForm(prev=> ({...prev, identification_number: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Teléfono</label>
                <input className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={userForm.phone} onChange={(e)=> setUserForm(prev=> ({...prev, phone: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Género</label>
                <select className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={userForm.gender || ''} onChange={(e)=> setUserForm(prev=> ({...prev, gender: e.target.value}))}>
                  <option value="">--</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="O">Otro</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-700">Dirección</label>
                <textarea rows={2} className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={userForm.address || ''} onChange={(e)=> setUserForm(prev=> ({...prev, address: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Tipo de usuario</label>
                <input className="w-full border border-gray-200 rounded-md bg-gray-50" value={userForm.user_type || ''} readOnly />
              </div>
              <div className="flex items-center gap-2">
                <input id="chk_active" type="checkbox" className="h-4 w-4" checked={!!userForm.is_active} onChange={(e)=> setUserForm(prev=> ({...prev, is_active: e.target.checked}))} />
                <label htmlFor="chk_active" className="text-sm text-gray-700">Activo</label>
              </div>
              {/* Rol del usuario (Combobox selección única) */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Roles</label>
                <div className="relative mt-2" ref={editRolesRef}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 text-left focus:ring-primary-500 focus:border-primary-500"
                    onClick={() => setIsEditRolesOpen(o => !o)}
                  >
                    <span className="truncate text-sm text-gray-800">
                      {!editUserRoleId ? 'Seleccionar rol' : (roles.find(r => r.id === editUserRoleId)?.name || 'Seleccionar rol')}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {isEditRolesOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-56 overflow-auto">
                      {roles.length === 0 && (
                        <div className="p-2 text-sm text-gray-500">No hay roles.</div>
                      )}
                      {roles.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          className={`w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 ${editUserRoleId === r.id ? 'bg-blue-50' : ''}`}
                          onClick={() => { setEditUserRoleId(r.id); setIsEditRolesOpen(false); }}
                        >
                          <span className="text-sm text-gray-800">{r.name}</span>
                          {editUserRoleId === r.id && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.2 7.2a1 1 0 01-1.415 0l-3.2-3.2a1 1 0 111.415-1.415l2.493 2.493 6.493-6.492a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">El tipo de usuario se ajusta automáticamente según el rol con mayor prioridad asignado.</p>
              </div>
              </div>
              <div className="mt-6 border-t pt-4">
                <h4 className="font-semibold mb-2">Cambiar contraseña</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-700">Nueva contraseña</label>
                    <input type="password" className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={pwdForm.new_password} onChange={(e)=> setPwdForm(prev=> ({...prev, new_password: e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700">Confirmar contraseña</label>
                    <input type="password" className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={pwdForm.new_password2} onChange={(e)=> setPwdForm(prev=> ({...prev, new_password2: e.target.value}))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button className="btn btn-secondary" onClick={saveUserPassword}>Actualizar contraseña</button>
                  <button className="btn btn-danger" onClick={deleteUser}>Eliminar usuario</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-outline-slim" onClick={()=> setIsUserModalOpen(false)}>Cerrar</button>
              <button className="btn btn-primary" onClick={saveUserEdit}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 bg-black/30 p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-xl mx-auto rounded shadow p-4 relative flex flex-col max-h-[90vh]">
            <button
              aria-label="Cerrar"
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setIsCreateUserModalOpen(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <h3 className="text-lg font-semibold mb-3">Nuevo usuario</h3>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-700">Usuario</label>
                <input className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={createUserForm.username} onChange={(e)=> setCreateUserForm(prev=> ({...prev, username: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Email</label>
                <input className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={createUserForm.email} onChange={(e)=> setCreateUserForm(prev=> ({...prev, email: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Nombre</label>
                <input className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={createUserForm.first_name} onChange={(e)=> setCreateUserForm(prev=> ({...prev, first_name: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Apellido</label>
                <input className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={createUserForm.last_name} onChange={(e)=> setCreateUserForm(prev=> ({...prev, last_name: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Contraseña</label>
                <input type="password" className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={createUserForm.password} onChange={(e)=> setCreateUserForm(prev=> ({...prev, password: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Confirmar contraseña</label>
                <input type="password" className="w-full border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500" value={createUserForm.password2} onChange={(e)=> setCreateUserForm(prev=> ({...prev, password2: e.target.value}))} />
              </div>
              {/* Rol para el nuevo usuario (Combobox selección única) */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Roles</label>
                <div className="relative mt-2" ref={createRolesRef}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 text-left focus:ring-primary-500 focus:border-primary-500"
                    onClick={() => setIsCreateRolesOpen(o => !o)}
                  >
                    <span className="truncate text-sm text-gray-800">
                      {!createUserRoleId ? 'Seleccionar rol' : (roles.find(r => r.id === createUserRoleId)?.name || 'Seleccionar rol')}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {isCreateRolesOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-56 overflow-auto">
                      {roles.length === 0 && (
                        <div className="p-2 text-sm text-gray-500">No hay roles.</div>
                      )}
                      {roles.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          className={`w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 ${createUserRoleId === r.id ? 'bg-blue-50' : ''}`}
                          onClick={() => { setCreateUserRoleId(r.id); setIsCreateRolesOpen(false); }}
                        >
                          <span className="text-sm text-gray-800">{r.name}</span>
                          {createUserRoleId === r.id && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.414l-7.2 7.2a1 1 0 01-1.415 0l-3.2-3.2a1 1 0 111.415-1.415l2.493 2.493 6.493-6.492a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Por defecto se selecciona “Cliente” si existe.</p>
              </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-outline-slim" onClick={()=> setIsCreateUserModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={submitCreateUser}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roles;
