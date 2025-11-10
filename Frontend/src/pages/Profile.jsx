import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/common/Header.jsx';
import orderService from '../services/orderService.js';
import toast from 'react-hot-toast';
import LocationPicker from '../components/maps/LocationPicker.jsx';
import AddressModal from '../components/addresses/AddressModal.jsx';

const Profile = () => {
  const { user, updateUser, isAuthenticated } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [resumeDraft, setResumeDraft] = useState(null);
  const [addressList, setAddressList] = useState([]);
  const [editingAddress, setEditingAddress] = useState(null); // full address object
  const [showAddModal, setShowAddModal] = useState(false);
  const [shippingList, setShippingList] = useState([]);
  const [paymentList, setPaymentList] = useState([]);
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

  // no longer needed: phone prefill handled by AddressModal

  // Load preferences & orders
  useEffect(() => {
    if (!isAuthenticated) return;
    const load = async () => {
      setLoadingPrefs(true);
      setLoadingOrders(true);
      try {
        const p = await orderService.getPreferences();
        setPrefs(p);
      } catch { setPrefs(null); }
      finally { setLoadingPrefs(false); }
      try { const addrs = await orderService.listAddresses(); setAddressList(Array.isArray(addrs)?addrs:[]);} catch { setAddressList([]);} 
      try { const ships = await orderService.listShipping(); setShippingList(Array.isArray(ships)?ships:[]);} catch { setShippingList([]);} 
      try { const pays = await orderService.listPayment(); setPaymentList(Array.isArray(pays)?pays:[]);} catch { setPaymentList([]);} 
      try {
        const o = await orderService.listOrders();
        setOrders(Array.isArray(o) ? o : []);
      } catch { setOrders([]); }
      finally { setLoadingOrders(false); }
      try {
        const draft = await orderService.getLatestDraft();
        setResumeDraft(draft);
      } catch { setResumeDraft(null); }
    };
    load();
  }, [isAuthenticated]);

  const onSubmit = async (data) => {
    await updateUser(data);
  };

  const savePreferences = async (e) => {
    e.preventDefault();
    if (!prefs) return;
    setSavingPrefs(true);
    try {
      const payload = {
        default_address: prefs.default_address || null,
        default_shipping_method: prefs.default_shipping_method || null,
        default_payment_method: prefs.default_payment_method || null,
      };
      const updated = await orderService.updatePreferences(payload);
      setPrefs(updated);
      toast.success('Preferencias guardadas');
    } catch {
      toast.error('No se pudieron guardar las preferencias');
    } finally { setSavingPrefs(false); }
  };

  // Address management handlers
  const startEditAddress = (addr) => { setEditingAddress(addr); };
  const handleUpdateAddress = async (payload) => {
    if (!editingAddress) return;
    try {
      await orderService.updateAddress(editingAddress.id, payload);
      toast.success('Dirección actualizada');
      const addrs = await orderService.listAddresses();
      setAddressList(Array.isArray(addrs)?addrs:[]);
    } catch { toast.error('No se pudo actualizar la dirección'); }
    finally { setEditingAddress(null); }
  };
  const deleteAddress = async (addr) => {
    if (!confirm('¿Eliminar esta dirección?')) return;
    try { await orderService.deleteAddress(addr.id); toast.success('Dirección eliminada'); const addrs = await orderService.listAddresses(); setAddressList(Array.isArray(addrs)?addrs:[]);} catch { toast.error('No se pudo eliminar'); }
  };
  // map selection handled inside AddressModal

  const handleCreateAddress = async (payload) => {
    try {
      const addr = await orderService.createAddress(payload);
      toast.success('Dirección agregada');
      const addrs = await orderService.listAddresses();
      setAddressList(Array.isArray(addrs)?addrs:[]);
    } catch { toast.error('No se pudo crear'); }
  };

  const resumeCheckout = () => {
    if (!resumeDraft) return;
    // Simple redirect to checkout; component will auto-detect items vs draft in future improvement
    // Could store draft id in sessionStorage if needed; for now rely on backend draft-latest endpoint
    toast('Reanudando checkout');
    navigate('/checkout');
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

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
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

        {/* Preferences */}
        <div className="border border-gray-900 p-6">
          <h2 className="text-lg font-medium mb-4">Preferencias de compra</h2>
          {loadingPrefs && <p className="text-xs text-gray-500">Cargando preferencias…</p>}
          {!loadingPrefs && (
            <form onSubmit={savePreferences} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="block text-xs mb-1">Dirección por defecto</label>
                <select value={prefs?.default_address || ''} onChange={e=>setPrefs(p=>({...p, default_address: e.target.value ? Number(e.target.value): null}))} className="w-full border px-2 py-1 text-xs bg-white">
                  <option value="">Sin preferencia</option>
                  {addressList.map(a=> (
                    <option key={a.id} value={a.id}>{(a.label || a.line1 || a.formatted_address || 'Dirección')} - {a.line1}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Envío por defecto</label>
                <select value={prefs?.default_shipping_method || ''} onChange={e=>setPrefs(p=>({...p, default_shipping_method: e.target.value ? Number(e.target.value): null}))} className="w-full border px-2 py-1 text-xs bg-white">
                  <option value="">Sin preferencia</option>
                  {shippingList.map(s=> (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Pago por defecto</label>
                <select value={prefs?.default_payment_method || ''} onChange={e=>setPrefs(p=>({...p, default_payment_method: e.target.value ? Number(e.target.value): null}))} className="w-full border px-2 py-1 text-xs bg-white">
                  <option value="">Sin preferencia</option>
                  {paymentList.map(p=> (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3 flex justify-end gap-2">
                <button type="submit" disabled={savingPrefs} className="btn-outline-slim text-xs">{savingPrefs ? 'Guardando…' : 'Guardar preferencias'}</button>
              </div>
            </form>
          )}
        </div>

        {/* Addresses management */}
        <div className="border border-gray-900 p-6">
          <h2 className="text-lg font-medium mb-4">Direcciones</h2>
          <div className="mb-3">
            <button className="btn text-xs" onClick={()=>setShowAddModal(true)}>Agregar dirección</button>
          </div>
          {addressList.length === 0 && <p className="text-xs text-gray-500">No tienes direcciones.</p>}
          <div className="space-y-3">
            {addressList.map(addr => (
              <div key={addr.id} className="border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{addr.label || '(Sin nombre)'} {addr.is_default && <span className="ml-1 text-[10px] text-emerald-600">(por defecto)</span>}</div>
                    <div className="text-gray-600">{addr.formatted_address || addr.line1}{addr.city ? `, ${addr.city}`:''} {addr.state?`(${addr.state})`:''}</div>
                    {addr.latitude && addr.longitude && (
                      <div className="text-gray-500">Lat: {Number(addr.latitude).toFixed(5)} Lng: {Number(addr.longitude).toFixed(5)}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-outline-slim" onClick={()=>startEditAddress(addr)}>Editar</button>
                    <button className="btn-outline-slim" onClick={()=>deleteAddress(addr)}>Eliminar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <AddressModal
            open={Boolean(editingAddress)}
            initial={editingAddress}
            defaultPhone={user?.phone}
            onSubmit={handleUpdateAddress}
            onClose={()=>setEditingAddress(null)}
            title="Editar dirección"
          />
        </div>

        <AddressModal
          open={showAddModal}
          onClose={()=>setShowAddModal(false)}
          onSubmit={handleCreateAddress}
          initial={null}
          defaultPhone={user?.phone}
          title="Agregar dirección"
        />

        {/* Purchase history */}
        <div className="border border-gray-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Historial de compras</h2>
            {resumeDraft && <button onClick={resumeCheckout} className="btn-outline-slim text-xs">Reanudar checkout en curso</button>}
          </div>
          {loadingOrders && <p className="text-xs text-gray-500">Cargando pedidos…</p>}
          {!loadingOrders && orders.filter(o=>o.status !== 'DRAFT').length === 0 && <p className="text-xs text-gray-500">No hay pedidos.</p>}
          {!loadingOrders && orders.filter(o=>o.status !== 'DRAFT').length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="p-2 border">ID</th>
                    <th className="p-2 border">Estado</th>
                    <th className="p-2 border">Items</th>
                    <th className="p-2 border">Subtotal</th>
                    <th className="p-2 border">Total</th>
                    <th className="p-2 border">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.filter(o=>o.status !== 'DRAFT').map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="p-2 border">{o.id}</td>
                      <td className="p-2 border">{o.status_label || (o.status === 'AWAITING_DISPATCH' ? 'En preparación' : o.status === 'PENDING_PAYMENT' ? 'Pendiente de pago' : o.status === 'CANCELED' ? 'Cancelado' : o.status === 'DELIVERED' ? 'Entregado' : o.status === 'REFUNDED' ? 'Reembolsado' : o.status)}</td>
                      <td className="p-2 border">{o.total_items}</td>
                      <td className="p-2 border">Bs. {Number(o.subtotal).toFixed(2)}</td>
                      <td className="p-2 border">Bs. {Number(o.grand_total).toFixed(2)}</td>
                      <td className="p-2 border">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default Profile;
