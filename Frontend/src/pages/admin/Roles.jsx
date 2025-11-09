import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import rbacService from '../../services/rbacService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import toast from 'react-hot-toast';

const Roles = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [selectedAvailable, setSelectedAvailable] = useState([]);
  const [selectedAssigned, setSelectedAssigned] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rolesData, usersData] = await Promise.all([
        rbacService.getRoles(),
        rbacService.getUsers(),
      ]);
      setRoles(rolesData);
      setUsers(usersData);
      if (!selectedRoleId && rolesData.length > 0) {
        setSelectedRoleId(rolesData[0].id);
      }
    } catch (err) {
      const msg = err?.detail || 'Error cargando datos de RBAC';
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{msg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  );

  const assignedUsers = useMemo(() => {
    if (!selectedRoleId) return [];
    return users.filter((u) => Array.isArray(u.role_ids) && u.role_ids.includes(selectedRoleId));
  }, [users, selectedRoleId]);

  const availableUsers = useMemo(() => {
    if (!selectedRoleId) return users;
    const assignedIds = new Set(assignedUsers.map((u) => u.id));
    return users.filter((u) => !assignedIds.has(u.id));
  }, [users, assignedUsers, selectedRoleId]);

  const handleAssign = async () => {
    if (!selectedRoleId || selectedAvailable.length === 0) return;
    try {
      const userIds = selectedAvailable;
      await rbacService.assignUsersToRole(selectedRoleId, userIds);
      toast.success(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">Usuarios asignados</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
      // Refresh users to reflect new role_ids
      const freshUsers = await rbacService.getUsers();
      setUsers(freshUsers);
      setSelectedAvailable([]);
    } catch (err) {
      const msg = err?.detail || 'No se pudo asignar usuarios';
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{msg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
    }
  };

  const handleRevoke = async () => {
    if (!selectedRoleId || selectedAssigned.length === 0) return;
    try {
      const userIds = selectedAssigned;
      await rbacService.revokeUsersFromRole(selectedRoleId, userIds);
      toast.success(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">Usuarios removidos</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
      const freshUsers = await rbacService.getUsers();
      setUsers(freshUsers);
      setSelectedAssigned([]);
    } catch (err) {
      const msg = err?.detail || 'No se pudo remover usuarios';
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{msg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
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
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Gestión de Roles</h1>
          <div className="space-x-2">
            <button className="btn-outline-slim" onClick={() => navigate('/')}>Inicio</button>
            <button className="btn-outline-slim" onClick={() => navigate('/dashboard')}>Panel</button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4">
        {/* Selector de Rol */}
  <div className="card-slim p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Selecciona un rol</label>
          <select
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
            value={selectedRoleId || ''}
            onChange={(e) => {
              setSelectedRoleId(parseInt(e.target.value, 10));
              setSelectedAvailable([]);
              setSelectedAssigned([]);
            }}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {selectedRole && (
            <p className="text-xs text-gray-500 mt-1">{selectedRole.description}</p>
          )}
        </div>

        {/* Asignación de Usuarios */}
  <div className="card-slim p-4">
          <h2 className="text-lg font-semibold mb-4">Asignar usuarios al rol</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Disponibles */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Disponibles</h3>
              <div className="border border-gray-200 rounded-none max-h-96 overflow-auto divide-y">
                {availableUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedAvailable.includes(u.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedAvailable((prev) =>
                          checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                        );
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name} <span className="text-gray-500">(@{u.username})</span></div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  </label>
                ))}
                {availableUsers.length === 0 && (
                  <div className="p-3 text-sm text-gray-500">No hay usuarios disponibles.</div>
                )}
              </div>
            </div>

            {/* Asignados */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Asignados</h3>
              <div className="border border-gray-200 rounded-none max-h-96 overflow-auto divide-y">
                {assignedUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedAssigned.includes(u.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedAssigned((prev) =>
                          checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                        );
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{u.first_name} {u.last_name} <span className="text-gray-500">(@{u.username})</span></div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  </label>
                ))}
                {assignedUsers.length === 0 && (
                  <div className="p-3 text-sm text-gray-500">No hay usuarios asignados.</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button className="btn btn-primary" onClick={handleAssign} disabled={!selectedRoleId || selectedAvailable.length === 0}>
              Asignar
            </button>
            <button className="btn btn-secondary" onClick={handleRevoke} disabled={!selectedRoleId || selectedAssigned.length === 0}>
              Remover
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Roles;
