import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/common/Header.jsx';
import toast from 'react-hot-toast';
import salesService from '../services/salesService.js';

const Sales = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [modalOrder, setModalOrder] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userOrders, setUserOrders] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { status, q, date_from: dateFrom, date_to: dateTo };
      if (userId) params.user = userId;
      params.page = page;
      params.page_size = pageSize;
      const data = await salesService.listOrdersPaged(params);
      if (data?.results) {
        setOrders(data.results);
        setTotal(data.count || 0);
      } else {
        setOrders(Array.isArray(data) ? data : []);
        setTotal(Array.isArray(data) ? data.length : 0);
      }
    } catch (e) {
      toast.error('No se pudo cargar ventas');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Auto-aplicar filtros cuando cambian (debounce para q)
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [status, userId, dateFrom, dateTo, q, pageSize]);

  useEffect(() => { load(); /* eslint-disable-line */ }, [page]);

  useEffect(() => {
    // preload users for dropdown
    (async () => {
      try {
        const list = await salesService.listUsers();
        setUsers(list);
      } catch (e) {
        // silent fail
      }
    })();
  }, []);

  const changeStatus = async (order, newStatus) => {
    try {
      const updated = await salesService.transition(order.id, newStatus);
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      toast.success('Estado actualizado');
    } catch (e) {
      toast.error('No se pudo actualizar');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Ordenes</h1>
          <div className="space-x-2">
            {/* <button className="btn-outline-slim" onClick={() => navigate('/dashboard')}>Ver ganancias</button> */}
            <button className="btn-outline-slim" onClick={load} disabled={loading}>{loading ? 'Cargando…' : 'Refrescar'}</button>
          </div>
        </div>

        <div className="card-slim p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <div>
              <label className="block mb-1">Estado</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} className="border px-2 py-1 bg-white">
                <option value="">Todos</option>
                <option value="PENDING_PAYMENT">Pendiente de pago</option>
                <option value="PAID">Pagado</option>
                <option value="AWAITING_DISPATCH">En preparación</option>
                <option value="SHIPPED">Enviada</option>
                <option value="DELIVERED">Entregado</option>
                <option value="CANCELED">Cancelado</option>
                <option value="REFUNDED">Reembolsado</option>
              </select>
            </div>
            <div>
              <label className="block mb-1">Usuario</label>
              <select value={userId} onChange={e=>setUserId(e.target.value)} className="border px-2 py-1 bg-white min-w-[220px]">
                <option value="">Todos</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email || u.username})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1">Buscar</label>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ID, email, usuario" className="border px-2 py-1" />
            </div>
            <div>
              <label className="block mb-1">Desde</label>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="border px-2 py-1" />
            </div>
            <div>
              <label className="block mb-1">Hasta</label>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="border px-2 py-1" />
            </div>
            <div className="flex flex-col">
              <label className="block mb-1">Cantidad de filas</label>
              <select value={pageSize} onChange={e=>setPageSize(Number(e.target.value)||10)} className="border px-2 py-1 bg-white">
                {[10,25,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-outline-slim text-xs" onClick={()=>{ setStatus(''); setUserId(''); setQ(''); setDateFrom(''); setDateTo(''); setPage(1); }}>Limpiar filtros</button>
            </div>
          </div>
        </div>

        <div className="card-slim p-0 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-2 border">ID</th>
                <th className="p-2 border">Estado</th>
                <th className="p-2 border">Usuario</th>
                <th className="p-2 border">Origen</th>
                <th className="p-2 border">Importe</th>
                <th className="p-2 border">Origen</th>
                <th className="p-2 border">Fecha</th>
                <th className="p-2 border">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{o.id}</td>
                  <td className="p-2 border">{o.status_label || o.status}</td>
                  <td className="p-2 border align-top">
                    <div className="text-[11px] text-gray-700 truncate">
                      {o.user_username || ''}
                      {(o.user_first_name || o.user_last_name) ? ` — ${(o.user_first_name || '')} ${(o.user_last_name || '')}` : ''}
                      {o.user_email ? ` — ${o.user_email}` : ''}
                    </div>
                    <a
                      href="#"
                      className="underline text-[11px]"
                      onClick={async (e)=>{
                        e.preventDefault();
                        const uid = o.user_id || o.user?.id;
                        if (!uid) return;
                        try {
                          const list = await salesService.listOrders({ user: uid });
                          setUserOrders(list);
                          setShowUserModal(true);
                        } catch (e) { /* ignore */ }
                      }}
                    >
                      Ver pedidos del usuario
                    </a>
                  </td>
                  <td className="p-2 border">
                    <button className="underline" onClick={()=>{ setModalOrder(o); setShowOrderModal(true); }}>
                      Ver productos
                    </button>
                  </td>
                  <td className="p-2 border">Bs. {Number(o.grand_total).toFixed(2)}</td>
                  <td className="p-2 border text-[11px]">
                    {(o.notes || '').includes('[POS_GUEST]') ? 'Caja (guest)' : (o.notes || '').includes('[POS]') ? 'Caja' : ''}
                  </td>
                  <td className="p-2 border">{o.created_at ? new Date(o.created_at).toLocaleString() : '—'}</td>
                  <td className="p-2 border">
                    <select
                      className="border px-2 py-1 bg-white"
                      value=""
                      onChange={async (e) => {
                        const val = e.target.value;
                        if (!val) return;
                        if ((val === 'CANCELED' || val === 'REFUNDED') && !window.confirm('¿Confirmar esta acción?')) {
                          e.target.value = '';
                          return;
                        }
                        await changeStatus(o, val);
                        e.target.value = '';
                      }}
                    >
                      <option value="">Acciones…</option>
                      {o.status !== 'AWAITING_DISPATCH' && <option value="AWAITING_DISPATCH">Marcar en preparación</option>}
                      {o.status !== 'DELIVERED' && <option value="DELIVERED">Marcar entregado</option>}
                      {o.status !== 'CANCELED' && <option value="CANCELED">Cancelar</option>}
                      {o.status !== 'REFUNDED' && <option value="REFUNDED">Reembolsar</option>}
                    </select>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td className="p-2 text-center text-gray-500" colSpan={7}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="max-w-7xl mx-auto p-4">
        {total > pageSize && (
          <div className="flex items-center justify-between text-xs mt-4">
            <div>Mostrando {orders.length} de {total} (Página {page})</div>
            <div className="flex gap-2">
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="btn-outline-slim" title="Anterior">‹</button>
              <button disabled={(page*pageSize)>=total} onClick={()=>setPage(p=>p+1)} className="btn-outline-slim" title="Siguiente">›</button>
            </div>
          </div>
        )}
      </div>
      {showOrderModal && modalOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-xl p-4 relative">
            <button className="absolute top-2 right-2" onClick={()=>{setShowOrderModal(false); setModalOrder(null);}}>✕</button>
            <h2 className="text-sm font-semibold mb-2">Orden #{modalOrder.id}</h2>
            <div className="max-h-80 overflow-y-auto text-xs">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left">
                    <th className="p-1 border">SKU</th>
                    <th className="p-1 border">Producto</th>
                    <th className="p-1 border">Talla</th>
                    <th className="p-1 border">Cant</th>
                  </tr>
                </thead>
                <tbody>
                  {(modalOrder.items || []).map(it => (
                    <tr key={it.id}>
                      <td className="p-1 border">{it.sku}</td>
                      <td className="p-1 border">{it.name}</td>
                      <td className="p-1 border">{it.variant_size || '—'}</td>
                      <td className="p-1 border">{it.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-2xl p-4 relative">
            <button className="absolute top-2 right-2" onClick={()=>{setShowUserModal(false); setUserOrders([]);}}>✕</button>
            <h2 className="text-sm font-semibold mb-2">Pedidos del Usuario</h2>
            {userOrders.length > 0 && (
              <div className="text-[11px] mb-2 text-gray-600">Usuario: {userOrders[0].user_username || userOrders[0].user_email}</div>
            )}
            <div className="max-h-[70vh] overflow-y-auto text-xs space-y-4">
              {userOrders.map(ord => (
                <div key={ord.id} className="border rounded p-2">
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold">Orden #{ord.id}</span>
                    <span>{ord.created_at ? new Date(ord.created_at).toLocaleString() : ''}</span>
                  </div>
                  <div className="text-[10px] mb-1 text-gray-500">Estado: {ord.status_label || ord.status}</div>
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-left">
                        <th className="p-1 border">SKU</th>
                        <th className="p-1 border">Producto</th>
                        <th className="p-1 border">Talla</th>
                        <th className="p-1 border">Cant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ord.items || []).map(it => (
                        <tr key={it.id}>
                          <td className="p-1 border">{it.sku}</td>
                          <td className="p-1 border">{it.name}</td>
                          <td className="p-1 border">{it.variant_size || '—'}</td>
                          <td className="p-1 border">{it.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {userOrders.length === 0 && <div className="text-center text-gray-500">Sin pedidos</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
