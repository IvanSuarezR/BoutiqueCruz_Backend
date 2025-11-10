import { useEffect, useState, useMemo } from 'react';
import Header from '../components/common/Header.jsx';
import inventoryService from '../services/inventoryService.js';
import orderService from '../services/orderService.js';
import salesService from '../services/salesService.js';
import toast from 'react-hot-toast';

// POS (Caja) page: quick product search by SKU or name, variant selection, inline cart and draft order confirmation.
// Assumptions: We will use an existing COD payment method and a pickup shipping method if available; if not found we just attempt confirm and show warning.

const Pos = () => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [cartItems, setCartItems] = useState([]); // { product, variant, quantity }
  const [placing, setPlacing] = useState(false);
  const [draftOrder, setDraftOrder] = useState(null);
  const [awaitingOrders, setAwaitingOrders] = useState([]);
  const [refreshingAwaiting, setRefreshingAwaiting] = useState(false);
  const [guestPurchase, setGuestPurchase] = useState(true); // Cliente no registrado por defecto
  const [addQty, setAddQty] = useState(1);
  const [detailModalOrder, setDetailModalOrder] = useState(null);
  const [assignUserQ, setAssignUserQ] = useState('');
  const [assignUserList, setAssignUserList] = useState([]);
  const [assignUser, setAssignUser] = useState(null);
  const [showUserSearch, setShowUserSearch] = useState(true);
  // Persist cart
  useEffect(()=>{
    try {
      const raw = localStorage.getItem('pos_cart_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCartItems(parsed);
      }
    } catch(_){}
  }, []);
  useEffect(()=>{
    try { localStorage.setItem('pos_cart_v1', JSON.stringify(cartItems)); } catch(_){}
  }, [cartItems]);

  // Load products matching query
  const searchProducts = async () => {
    setLoadingProducts(true);
    try {
      const qparam = (query || '').trim();
      let data = [];
      if (qparam) {
        // Intentar coincidencia exacta por SKU primero
        data = await inventoryService.getProducts({ sku: qparam, is_active: true, sort: 'name' });
        if (!Array.isArray(data) || data.length === 0) {
          data = await inventoryService.getProducts({ q: qparam, is_active: true, sort: 'name' });
        }
      } else {
        data = await inventoryService.getProducts({ is_active: true, sort: 'name' });
      }
      setProducts(Array.isArray(data) ? data.slice(0, 50) : []);
    } catch (e) {
      toast.error('No se pudo buscar');
    } finally { setLoadingProducts(false); }
  };

  // Auto-load products on mount and when query changes (debounced)
  useEffect(() => {
    const t = setTimeout(() => { searchProducts(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  
  // Load PENDING_PAYMENT and AWAITING_DISPATCH for side panel
  const loadAwaiting = async () => {
    setRefreshingAwaiting(true);
    try {
      const [pending, awaiting] = await Promise.all([
        salesService.listOrders({ status: 'PENDING_PAYMENT' }),
        salesService.listOrders({ status: 'AWAITING_DISPATCH' }),
      ]);
      const merged = [...(Array.isArray(pending)? pending : []), ...(Array.isArray(awaiting)? awaiting : [])];
      setAwaitingOrders(merged.slice(0, 30));
    } catch (e) { /* silent */ } finally { setRefreshingAwaiting(false); }
  };
  useEffect(() => { loadAwaiting(); }, []);
  // Load users for assignment when guest disabled
  useEffect(() => {
    if (guestPurchase) return;
    const t = setTimeout(async () => {
      try {
        // Try extended list with all=1 first
        const listAll = await salesService.listUsers(assignUserQ || '', true);
        if (Array.isArray(listAll) && listAll.length) {
          setAssignUserList(listAll);
        } else {
          const list = await salesService.listUsers(assignUserQ || '');
          setAssignUserList(Array.isArray(list) ? list : []);
        }
      } catch (_) { setAssignUserList([]); }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [assignUserQ, guestPurchase]);

  const addToCart = (product, variant, qty = 1) => {
    if (!product) return;
    setCartItems(prev => {
      const existingIndex = prev.findIndex(it => it.product.id === product.id && ((it.variant?.id)||null) === ((variant?.id)||null));
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex].quantity += qty;
        return copy;
      }
      return [...prev, { product, variant: variant || null, quantity: qty }];
    });
  };

  const updateQty = (idx, qty) => {
    setCartItems(prev => prev.map((it,i)=> i===idx ? { ...it, quantity: qty < 1 ? 1 : qty } : it));
  };
  const removeItem = (idx) => setCartItems(prev => prev.filter((_,i)=> i!==idx));
  const clearCart = async () => {
    try {
      // Solo cancelar automáticamente si la orden aún no está pagada (borrador o pendiente de pago)
      if (draftOrder && ['DRAFT','PENDING_PAYMENT'].includes(draftOrder.status)) {
        await salesService.transition(draftOrder.id, 'CANCELED');
        setDraftOrder(null);
      }
    } catch(_){/* silent */}
    setCartItems([]);
  };

  const subtotal = useMemo(()=> cartItems.reduce((s,it)=> s + (Number(it.product.price)||0)*it.quantity, 0), [cartItems]);

  const startOrder = async () => {
    if (cartItems.length === 0) { toast.error('Carrito vacío'); return; }
    setPlacing(true);
    try {
      // Build items payload
      const itemsPayload = cartItems.map(it => ({ product_id: it.product.id, variant_id: it.variant?.id, quantity: it.quantity }));
      let order = await orderService.start(itemsPayload);
      // If user selected for assignment and not guest, reassign
      if (!guestPurchase && assignUser?.id) {
        try { await orderService.setCustomer(order.id, assignUser.id); } catch (_) {}
      }
      // Marcar origen POS en notas
      try {
        const marker = guestPurchase ? '[POS_GUEST]' : '[POS]';
        await orderService.updateOrder(order.id, { notes: (order.notes ? `${order.notes} ` : '') + marker });
      } catch (_) {}
      // Intentar dejar la orden en Pago pendiente (auto-confirmar con métodos por defecto)
      try {
        if (!order.shipping_method) {
          const shipping = await orderService.listShipping();
          const pickup = shipping.find(s => s.requires_pickup_point) || shipping[0];
          if (pickup) order = await orderService.setShipping(order.id, pickup.id);
        }
      } catch(_){}
      try {
        if (!order.payment_method) {
          const pm = await orderService.listPayment();
          const cod = pm.find(p => p.type === 'COD') || pm.find(p => p.type === 'OFFLINE') || pm[0];
          if (cod) order = await orderService.setPayment(order.id, cod.id);
        }
      } catch(_){}
      try {
        if (order.status === 'DRAFT') {
          order = await orderService.confirm(order.id);
        }
      } catch(_){ }
      setDraftOrder(order);
      if (order.status_label) {
        toast.success(`Orden creada (${order.status_label})`);
      } else if (order.status) {
        const label = order.status === 'PENDING_PAYMENT' ? 'Pendiente de pago' : (order.status === 'DRAFT' ? 'Borrador' : order.status);
        toast.success(`Orden creada (${label})`);
      } else {
        toast.success('Orden creada');
      }
    } catch (e) {
      toast.error('Error creando orden');
    } finally { setPlacing(false); }
  };

  const confirmOrder = async () => {
    if (!draftOrder) { toast.error('Primero crea la orden'); return; }
    setPlacing(true);
    try {
      let ord = draftOrder;
      // Garantizar métodos por defecto (envío y pago) antes de confirmar el borrador
      try {
        if (!ord.shipping_method) {
          const shipping = await orderService.listShipping();
          const pickup = shipping.find(s => s.requires_pickup_point) || shipping[0];
          if (pickup) ord = await orderService.setShipping(ord.id, pickup.id);
        }
      } catch (_) {}
      try {
        if (!ord.payment_method) {
          const pm = await orderService.listPayment();
          const cod = pm.find(p => p.type === 'COD') || pm.find(p => p.type === 'OFFLINE') || pm[0];
          if (cod) ord = await orderService.setPayment(ord.id, cod.id);
        }
      } catch (_) {}
      // Confirmar borrador -> PENDING_PAYMENT (o PAID si gateway exitoso)
      if (ord.status === 'DRAFT') {
        ord = await orderService.confirm(ord.id);
      }
      // Intentar marcar como PAID sólo si estamos en PENDING_PAYMENT
      if (ord.status === 'PENDING_PAYMENT') {
        try {
          ord = await salesService.transition(ord.id, 'PAID');
          toast.success('Orden marcada como Pagada');
        } catch (_) {
          toast.success('Orden confirmada');
        }
      } else {
        toast.success('Orden confirmada');
      }
      // En este punto la orden ya está colocada; limpiamos referencia local para iniciar un nuevo flujo
      setDraftOrder(null);
      setCartItems([]);
      loadAwaiting();
      try { searchProducts(); } catch(_){ }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Fallo al confirmar');
    } finally { setPlacing(false); }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-7xl mx-auto p-4">
        <h1 className="text-xl font-semibold mb-4">Caja (POS)</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Search + products */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card-slim p-3 flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs block mb-1">Buscar producto (SKU o nombre)</label>
                <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ej: CAMISA, SKU123" className="border px-2 py-1 w-full" onKeyDown={(e)=>{ if (e.key==='Enter') searchProducts(); }} />
                <div className="mt-1 text-[10px] text-gray-500">Para SKU, pegue el código exacto para coincidencia directa.</div>
              </div>
              {/* <div className="flex flex-col text-xs">
                <label className="mb-1">Cantidad a agregar</label>
                <input type="number" min={1} value={addQty} onChange={e=>setAddQty(Math.max(1, parseInt(e.target.value)||1))} className="border px-2 py-1 w-24" />
              </div> */}
              {/* <button onClick={searchProducts} disabled={loadingProducts} className="btn-outline-slim text-xs">{loadingProducts? 'Buscando…':'Buscar'}</button> */}
            </div>
            <div className="card-slim p-0">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="p-2 border">Imagen</th>
                    <th className="p-2 border">SKU</th>
                    <th className="p-2 border">Producto</th>
                    <th className="p-2 border">Precio</th>
                    <th className="p-2 border">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 align-top">
                      <td className="p-2 border w-[60px]">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-12 h-12 object-cover" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 border" />
                        )}
                      </td>
                      <td className="p-2 border text-[11px]">{p.sku}</td>
                      <td className="p-2 border">
                        <div className="text-[11px] font-semibold flex items-center gap-2">
                          <span>{p.name}</span>
                          {/* For products without variants show quick add button next to name */}
                          {(!p.variants || p.variants.length === 0) && (
                            <button disabled={p.stock<=0} onClick={()=> addToCart(p, null, addQty)} className="btn-outline-slim text-[10px]">Agregar ×{addQty}</button>
                          )}
                        </div>
                        {Array.isArray(p.variants) && p.variants.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.variants.map(v => (
                              <button
                                key={v.id}
                                disabled={v.stock <= 0}
                                onClick={()=> addToCart(p, v, addQty)}
                                className={`px-2 py-1 text-[10px] border rounded ${v.stock>0? 'hover:bg-gray-900 hover:text-white':'opacity-40 cursor-not-allowed'}`}
                                title={`Talla ${v.size} (stock ${v.stock})`}
                              >{v.size} ({v.stock}) ×{addQty}</button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-2 border">Bs. {Number(p.price).toFixed(2)}</td>
                      <td className="p-2 border">{p.stock}</td>
                      {/* keep columns to 5 total */}
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td className="p-2 text-center text-gray-500" colSpan={5}>Sin resultados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Cart + actions */}
          <div className="space-y-4">
            <div className="card-slim p-3">
              <h2 className="text-sm font-semibold mb-2">Carrito</h2>
              {cartItems.length === 0 && <div className="text-xs text-gray-500">Vacío</div>}
              <div className="space-y-2">
                {cartItems.map((it, idx) => (
                  <div key={idx} className="border rounded p-2 flex flex-col gap-1 bg-white">
                    <div className="flex justify-between text-[11px]">
                      <span>{it.product.name} {it.variant? `- ${it.variant.size}`: ''}</span>
                      <button onClick={()=>removeItem(idx)} className="text-red-600 hover:underline">✕</button>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span>Cantidad:</span>
                      <input type="number" min={1} value={it.quantity} onChange={e=>updateQty(idx, parseInt(e.target.value)||1)} className="border px-1 py-0.5 w-16 text-xs" />
                      <span>Unit: Bs. {Number(it.product.price).toFixed(2)}</span>
                      <span className="ml-auto font-semibold">{(Number(it.product.price)||0 * it.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs mt-3 flex justify-between">
                <span>Subtotal:</span>
                <span className="font-semibold">Bs. {subtotal.toFixed(2)}</span>
              </div>
              <div className="mt-3 text-[11px] flex items-center gap-2">
                <input id="guest" type="checkbox" checked={guestPurchase} onChange={e=>setGuestPurchase(e.target.checked)} />
                <label htmlFor="guest">Cliente no registrado</label>
              </div>
              {!guestPurchase && (
                <div className="mt-2 text-[11px]">
                  {!assignUser || showUserSearch ? (
                    <>
                      <div className="mb-1 flex justify-between items-center">
                        <span>Asignar a cliente</span>
                        {assignUser && <button className="underline" onClick={()=>setShowUserSearch(false)}>Ocultar</button>}
                      </div>
                      <input value={assignUserQ} onChange={e=>setAssignUserQ(e.target.value)} placeholder="Usuario, nombre o correo" className="border px-2 py-1 w-full" />
                      <div className="max-h-40 overflow-y-auto border mt-1 bg-white">
                        {assignUserList.map(u => (
                          <div key={u.id} className={`px-2 py-1 cursor-pointer hover:bg-gray-100 ${assignUser?.id===u.id?'bg-gray-50':''}`} onClick={()=>{setAssignUser(u); setShowUserSearch(false);}}>
                            <div className="font-medium">{u.username} — {u.first_name} {u.last_name}</div>
                            <div className="text-gray-500">{u.email}</div>
                          </div>
                        ))}
                        {assignUserList.length===0 && <div className="px-2 py-1 text-gray-500">Escribe para buscar…</div>}
                      </div>
                    </>
                  ) : (
                    <div className="border p-2 rounded bg-white cursor-pointer" onClick={()=> setShowUserSearch(true)}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold">{assignUser.username}</span>
                        <button className="underline" onClick={()=>{ setShowUserSearch(true); }}>Cambiar</button>
                      </div>
                      <div>{assignUser.first_name} {assignUser.last_name}</div>
                      <div className="text-gray-500">{assignUser.email}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={clearCart} disabled={cartItems.length===0 && !draftOrder} className="btn-outline-slim flex-1 text-xs">Limpiar</button>
                {!draftOrder && <button onClick={startOrder} disabled={placing || cartItems.length===0} className="btn-outline-slim flex-1 text-xs">Crear Orden</button>}
                {draftOrder && <button onClick={confirmOrder} disabled={placing} className="btn-outline-slim flex-1 text-xs">Confirmar Pedido</button>}
                {draftOrder && ['DRAFT','PENDING_PAYMENT'].includes(draftOrder.status) && (
                  <button onClick={async()=>{
                    if (!window.confirm('¿Cancelar esta orden?')) return;
                    try { await orderService.updateOrder(draftOrder.id,{ notes: (draftOrder.notes? draftOrder.notes+' ':'')+'[POS_CANCEL]'}); } catch(_){ }
                    try { await salesService.transition(draftOrder.id,'CANCELED'); toast.success('Orden cancelada'); setDraftOrder(null); setCartItems([]); } catch(e){ toast.error('No se pudo cancelar'); }
                  }} className="btn-outline-slim flex-1 text-xs text-red-600">Cancelar Orden</button>
                )}
              </div>
              {draftOrder && (
                <div className="mt-2 text-[11px] text-gray-600">Orden en curso #{draftOrder.id} — {draftOrder.status_label || draftOrder.status}</div>
              )}
            </div>
            <div className="card-slim p-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">En preparación</h2>
                <button onClick={loadAwaiting} disabled={refreshingAwaiting} className="btn-outline-slim text-[10px]">{refreshingAwaiting?'…':'Refrescar'}</button>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {awaitingOrders.map(o => (
                  <div key={o.id} className="border rounded p-2 text-[11px] bg-white">
                    <div className="flex justify-between"><span>#{o.id}</span><span>{o.total_items || (o.items? o.items.length: 0)} ítems</span></div>
                    <div className="text-gray-500">{o.user_username || o.user_email || 'Cliente'}</div>
                    <div className="text-[10px] text-gray-400">{o.created_at ? new Date(o.created_at).toLocaleTimeString() : ''}</div>
                    <div className="text-[10px] mb-2 font-medium">{o.status_label || o.status}</div>
                    <div className="flex flex-wrap gap-1">
                      <button className="btn-outline-slim text-[10px]" onClick={async ()=>{ try { const full = await salesService.getOrder(o.id); setDetailModalOrder(full);} catch(e){/* ignore */}}}>Detalle</button>
                      {o.status === 'PENDING_PAYMENT' && (
                        <button className="btn-outline-slim text-[10px]" onClick={async ()=>{ try { await salesService.transition(o.id,'AWAITING_DISPATCH'); toast.success('Pasó a preparación'); loadAwaiting(); } catch(e){ toast.error('No se pudo cambiar'); } }}>Preparar</button>
                      )}
                      {o.status !== 'DELIVERED' && (
                        <button className="btn-outline-slim text-[10px]" onClick={async ()=>{ if(!window.confirm('¿Marcar entregado?')) return; try { await salesService.transition(o.id,'DELIVERED'); toast.success('Entregado'); loadAwaiting(); } catch(e){ toast.error('Error'); } }}>Entregado</button>
                      )}
                      {o.status !== 'CANCELED' && o.status !== 'DELIVERED' && (
                        <button className="btn-outline-slim text-[10px] text-red-600" onClick={async ()=>{ if(!window.confirm('¿Cancelar esta orden?')) return; try { await salesService.transition(o.id,'CANCELED'); toast.success('Cancelada'); loadAwaiting(); } catch(e){ toast.error('Error al cancelar'); } }}>Cancelar</button>
                      )}
                    </div>
                  </div>
                ))}
                {awaitingOrders.length === 0 && <div className="text-[11px] text-gray-500">No hay órdenes</div>}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 text-[11px] text-gray-500 max-w-3xl">
          {/* <p><strong>Nota:</strong> Para confirmar la orden se requiere que el servidor haya asignado métodos de envío y pago válidos (por ejemplo, retiro en tienda + pago en efectivo). Si falta alguno, la confirmación fallará.</p> */}
        </div>
      </div>
      {detailModalOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg w-full max-w-xl p-4 relative">
            <button className="absolute top-2 right-2" onClick={()=>setDetailModalOrder(null)}>✕</button>
            <h2 className="text-sm font-semibold mb-2">Orden #{detailModalOrder.id}</h2>
            <div className="text-[11px] mb-2 text-gray-600">Estado: {detailModalOrder.status_label || detailModalOrder.status}</div>
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
                  {(detailModalOrder.items||[]).map(it => (
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
    </div>
  );
};

export default Pos;
