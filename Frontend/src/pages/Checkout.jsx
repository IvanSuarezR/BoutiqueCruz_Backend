import Header from '../components/common/Header.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import {loadStripe} from '@stripe/stripe-js';
import {Elements, CardElement, useStripe, useElements} from '@stripe/react-stripe-js';
import orderService from '../services/orderService.js';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import LocationPicker from '../components/maps/LocationPicker.jsx'; // kept for modal usage inside AddressModal
import AddressModal from '../components/addresses/AddressModal.jsx';

// Checkout simplificado: un único formulario que recoge envío, dirección (si aplica) y pago.
// Tras guardar todo, pasa a paso de revisión/confirmación.
const Checkout = () => {
  const { items, totals, clearCart } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Pasos: 1 = formulario, 2 = revisar
  const [step, setStep] = useState(1);
  const [order, setOrder] = useState(null); // borrador/orden configurada
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Catálogos y preferencias
  const [shippingMethods, setShippingMethods] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [prefs, setPrefs] = useState(null);

  // Selecciones
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Direcciones existentes + selección
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAddressObj, setEditingAddressObj] = useState(null);

  const requiresPickup = useMemo(() => {
    const chosen = shippingMethods.find(m => m.id === selectedShipping);
    return Boolean(chosen && chosen.requires_pickup_point);
  }, [shippingMethods, selectedShipping]);

  // Carga inicial: métodos, preferencias y prefill dirección.
  const loadForForm = async () => {
    setLoading(true);
    try {
      const [p, ships, pays] = await Promise.all([
        orderService.getPreferences().catch(()=>null),
        orderService.listShipping().catch(()=>[]),
        orderService.listPayment().catch(()=>[]),
      ]);
      if (p) setPrefs(p);
      const shipsArr = Array.isArray(ships) ? ships : [];
      const paysArr = Array.isArray(pays) ? pays : [];
      setShippingMethods(shipsArr);
      setPaymentMethods(paysArr);

      if (p?.default_shipping_method) {
        const found = shipsArr.find(m => m.id === p.default_shipping_method);
        if (found) setSelectedShipping(found.id);
      }
      if (p?.default_payment_method) {
        const found = paysArr.find(pm => pm.id === p.default_payment_method);
        if (found) setSelectedPayment(found.id);
      }
      // Cargar direcciones
      try {
        const addrs = await orderService.listAddresses();
        const arr = Array.isArray(addrs) ? addrs : [];
        setAddresses(arr);
        const def = arr.find(a => a.is_default) || arr[0];
        if (def) setSelectedAddress(def.id);
      } catch (e) {
        setAddresses([]);
        // eslint-disable-next-line no-console
        console.error('[checkout] error cargando direcciones', e?.response?.status);
      }
    } finally { setLoading(false); }
  };

  const startOrder = async () => {
    if (!items.length) return null;
    const payloadItems = items.map(i => ({
      product_id: i.id,
      quantity: i.qty,
      variant_id: i.variantId || null,
      size_label: i.selectedSize || null,
    }));
    const data = await orderService.start(payloadItems);
    setOrder(data);
    return data;
  };

  const submitSingleForm = async (e) => {
    e?.preventDefault?.();
    if (!items.length) { toast.error('Carrito vacío'); return; }
    if (!selectedShipping) { toast.error('Selecciona un método de envío'); return; }
    if (!selectedPayment) { toast.error('Selecciona un método de pago'); return; }
    if (!requiresPickup && !selectedAddress) { toast.error('Selecciona una dirección'); return; }
    setLoading(true);
    try {
      let current = order || await startOrder();
      // 1) Envío
      if (current && selectedShipping) {
        current = await orderService.setShipping(current.id, selectedShipping);
      }
      // 2) Asignar dirección seleccionada si aplica
      if (!requiresPickup && selectedAddress) {
        current = await orderService.setAddress(current.id, selectedAddress);
      }
      // 3) Pago
      current = await orderService.setPayment(current.id, selectedPayment);
      setOrder(current);
      setStep(2);
      toast.success('Datos guardados, revisa y confirma');
    } catch (err) {
      toast.error('No se pudo procesar');
      // eslint-disable-next-line no-console
      console.error('[checkout submit] error', { status: err?.response?.status, data: err?.response?.data });
    } finally { setLoading(false); }
  };

  // Stripe logic
  const stripePromise = useMemo(()=>{
    // Leer de runtime env (window._env_) primero, luego fallback a import.meta.env
    const runtimeEnv = typeof window !== 'undefined' && window._env_ ? window._env_ : {};
    const pk = runtimeEnv.VITE_STRIPE_PUBLISHABLE_KEY || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    return pk ? loadStripe(pk) : null;
  },[]);
  // Mantener opciones estables para evitar remount del <Elements>
  const elementsOptions = useMemo(() => ({ locale: 'es' }), []);

  const isStripeSelected = useMemo(()=>{
    const pm = paymentMethods.find(x=>x.id===selectedPayment);
    if (!pm) return false;
    // Acepta por code o por proveedor gateway
    return pm.code === 'STRIPE' || pm.gateway_provider === 'stripe' || (pm.type === 'GATEWAY' && pm.name?.toLowerCase().includes('stripe'));
  },[paymentMethods, selectedPayment]);

  // Etiquetas amigables de métodos de pago
  const sanitizeName = (name) => {
    if (!name) return '';
    return name.replace(/\(modo prueba\)/ig, '').trim();
  };
  const formatPaymentLabel = (pm) => {
    if (!pm) return '';
    const stripeLike = pm.code === 'STRIPE' || pm.gateway_provider === 'stripe' || (pm.type === 'GATEWAY' && pm.name?.toLowerCase().includes('stripe'));
    if (stripeLike) return 'Tarjeta';
    if (pm.type === 'COD') return 'En efectivo';
    return sanitizeName(pm.name || '');
  };

  const confirmNonStripe = async () => {
    if (!order) return;
    setConfirming(true);
    try {
      const data = await orderService.confirm(order.id);
      setOrder(data);
      toast.success('Pedido confirmado');
      clearCart();
      navigate('/');
    } catch (e) {
      if (e.response?.data?.errors) toast.error('Stock insuficiente'); else toast.error('Error confirmando');
    } finally { setConfirming(false); }
  };

  // Wrapper para loggear montajes/desmontajes del CardElement
  // Componente para usar SOLO Stripe Checkout hospedado
  const StripeCheckoutConfirm = ({ order }) => {
    const [loadingCheckout, setLoadingCheckout] = useState(false);
    const startHostedCheckout = async () => {
      if (loadingCheckout) return;
      setLoadingCheckout(true);
      try {
        const origin = window.location.origin + '/checkout';
        const data = await orderService.createStripeCheckout(order.id, origin);
        if (data?.url) {
          window.location.href = data.url;
        } else {
          toast.error('Checkout no disponible');
        }
      } catch (e) {
        toast.error('Error iniciando Stripe Checkout');
      } finally {
        setLoadingCheckout(false);
      }
    };
    return (
      <div className="flex flex-col gap-2">
        <button type="button" className="btn text-xs" onClick={startHostedCheckout} disabled={loadingCheckout}>
          {loadingCheckout ? 'Redirigiendo…' : 'Confirmar pedido'}
        </button>
        <button type="button" className="btn-outline-slim text-[11px]" onClick={()=>setStep(1)} disabled={loadingCheckout}>Volver</button>
        <span className="text-[10px] text-gray-400">Serás redirigido a la página segura de pago y volverás automáticamente.</span>
      </div>
    );
  };

  const confirmOrder = async () => {
    if (isStripeSelected) return; // con Stripe usamos Checkout hospedado
    return confirmNonStripe();
  };

  // Stripe Checkout (hosted): si query param session_id viene al volver de Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const success = params.get('success');
    const oid = params.get('order_id');
    if (sessionId && success === '1' && oid) {
      const key = `stripe_session_processed_${sessionId}`;
      if (sessionStorage.getItem(key)) {
        // ya procesado
        return;
      }
      (async () => {
        try {
          const data = await orderService.confirmWithSession(oid, sessionId);
          setOrder(data);
          toast.success('Pago confirmado');
          clearCart();
          navigate('/');
        } catch (e) {
          toast.error('No se pudo confirmar sesión');
        }
      })();
      // marcar como procesado y limpiar la URL para evitar re-disparo
      sessionStorage.setItem(key, '1');
      const url = new URL(window.location.href);
      url.searchParams.delete('session_id');
      url.searchParams.delete('success');
      url.searchParams.delete('order_id');
      window.history.replaceState({}, document.title, url.toString());
    }
  }, [clearCart, navigate]);

  useEffect(() => {
    if (user) loadForForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Si no hay preferencia de pago, elegir Stripe por defecto si existe
  useEffect(()=>{
    if (!selectedPayment && paymentMethods?.length){
      const stripePm = paymentMethods.find(pm => pm.code === 'STRIPE' || pm.gateway_provider === 'stripe' || (pm.type==='GATEWAY' && pm.name?.toLowerCase().includes('stripe')));
      if (stripePm) setSelectedPayment(stripePm.id);
    }
  },[paymentMethods, selectedPayment]);

  // Crear dirección (modal)
  const handleCreateAddress = async (payload) => {
    const addr = await orderService.createAddress(payload);
    toast.success('Dirección creada');
    const list = await orderService.listAddresses();
    const arr = Array.isArray(list) ? list : [];
    setAddresses(arr);
    setSelectedAddress(addr.id);
    setShowAddModal(false);
    return addr;
  };
  // Editar dirección seleccionada
  const handleUpdateAddress = async (payload) => {
    if (!editingAddressObj) return;
    const updated = await orderService.updateAddress(editingAddressObj.id, payload);
    toast.success('Dirección actualizada');
    const list = await orderService.listAddresses();
    const arr = Array.isArray(list) ? list : [];
    setAddresses(arr);
    setSelectedAddress(updated.id || editingAddressObj.id);
    setShowEditModal(false);
    return updated;
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-6">Finalizar compra</h1>
        {items.length === 0 ? (
          <div className="text-sm text-gray-600">
            Tu carrito está vacío. <Link className="link" to="/">Volver al inicio</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {step === 1 && (
                <form onSubmit={submitSingleForm} className="card-slim p-4 space-y-6">
                  <h2 className="text-lg font-medium">Datos de envío y pago</h2>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Método de envío</h3>
                    {loading && shippingMethods.length === 0 && (<div className="text-xs text-gray-500">Cargando…</div>)}
                    {!loading && shippingMethods.length === 0 && (<div className="text-xs text-red-600">No hay métodos disponibles.</div>)}
                    {shippingMethods.map(m => (
                      <label key={m.id} className="flex items-start gap-2 text-sm border p-2 cursor-pointer">
                        <input type="radio" name="ship" checked={selectedShipping === m.id} onChange={() => setSelectedShipping(m.id)} />
                        <span className="flex-1">
                          <strong>{m.name}</strong> {m.description && `- ${m.description}`}<br />
                          <span className="text-xs text-gray-500">Costo: Bs. {Number(m.base_cost).toFixed(2)} | Tiempo: {m.transit_days_min}-{m.transit_days_max} días</span>
                          {m.requires_pickup_point && <span className="block text-[11px] text-emerald-600 mt-1">Retiro en punto de venta (no requiere dirección)</span>}
                        </span>
                      </label>
                    ))}
                  </div>

                  {!requiresPickup && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Dirección de entrega</h3>
                      {addresses.length === 0 && <div className="text-xs text-gray-500">No tienes direcciones guardadas.</div>}
                      <div className="space-y-2">
                        {addresses.map(a => (
                          <label key={a.id} className="flex items-start gap-2 text-sm border p-2 cursor-pointer">
                            <input type="radio" name="addr" checked={selectedAddress === a.id} onChange={() => setSelectedAddress(a.id)} />
                            <span className="flex-1">
                              <strong>{a.label || '(Sin nombre)'}</strong> - {(a.formatted_address || a.line1)}, {a.city} {a.state && `(${a.state})`} {a.phone && `Tel: ${a.phone}`}
                              {a.latitude && a.longitude && <span className="block text-[10px] text-gray-500 mt-1">Lat: {Number(a.latitude).toFixed(4)} Lng: {Number(a.longitude).toFixed(4)}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button type="button" className="btn-outline-slim" onClick={()=>setShowAddModal(true)}>Agregar dirección</button>
                        {selectedAddress && <button type="button" className="btn-outline-slim" onClick={()=>{ const obj = addresses.find(x=>x.id===selectedAddress); setEditingAddressObj(obj); setShowEditModal(true); }}>Editar seleccionada</button>}
                      </div>
                    </div>
                  )}
              

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Método de pago</h3>
                    {paymentMethods.map(pm => {
                      const stripeLike = pm.code === 'STRIPE' || pm.gateway_provider === 'stripe' || (pm.type === 'GATEWAY' && pm.name?.toLowerCase().includes('stripe'));
                      return (
                        <label key={pm.id} className={`flex items-start gap-2 text-sm border p-2 cursor-pointer ${stripeLike ? 'border-emerald-500' : ''}`}>
                          <input type="radio" name="pay" checked={selectedPayment === pm.id} onChange={() => setSelectedPayment(pm.id)} />
                          <span className="flex-1">
                            <strong>{formatPaymentLabel(pm)}</strong>
                            {pm.instructions && <span className="text-xs text-gray-500 block mt-1">{pm.instructions}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <button type="button" className="btn-outline-slim text-xs" onClick={()=>navigate('/cart')}>Volver al carrito</button>
                    <button type="submit" className="btn text-xs" disabled={loading}>{loading ? 'Guardando…' : 'Continuar'}</button>
                  </div>
                </form>
              )}

              {/* Modales dirección (fuera del <form> para evitar submits anidados) */}
              <AddressModal
                open={showAddModal}
                onClose={()=>setShowAddModal(false)}
                onSubmit={handleCreateAddress}
                initial={null}
                defaultPhone={user?.phone}
                title="Agregar dirección"
              />
              <AddressModal
                open={showEditModal}
                onClose={()=>setShowEditModal(false)}
                onSubmit={handleUpdateAddress}
                initial={editingAddressObj}
                defaultPhone={user?.phone}
                title="Editar dirección"
              />

              {step === 2 && order && (
                <div className="card-slim p-4 space-y-4">
                  <h2 className="text-lg font-medium">Revisar y confirmar</h2>
                  <p className="text-xs text-gray-600">Verifica los datos antes de confirmar tu pedido.</p>
                  <div className="text-xs space-y-1">
                    <div><strong>Envío:</strong> {order.shipping_method_name} (Bs. {Number(order.shipping_cost).toFixed(2)})</div>
                    {order.shipping_address_snapshot && (
                      <div><strong>Dirección:</strong> {order.shipping_address_snapshot?.line1}, {order.shipping_address_snapshot?.city}</div>
                    )}
                    <div><strong>Pago:</strong> {(() => { const pm = paymentMethods.find(x=>x.id===selectedPayment); return pm ? formatPaymentLabel(pm) : sanitizeName(order.payment_method_name); })()}</div>
                  </div>
                  {!isStripeSelected && (
                    <div className="flex gap-2">
                      <button className="btn-outline-slim text-xs" onClick={()=>setStep(1)}>Volver</button>
                      <button className="btn text-xs" disabled={confirming} onClick={confirmOrder}>{confirming ? 'Confirmando…' : 'Confirmar pedido'}</button>
                    </div>
                  )}
                  {isStripeSelected && order && (
                    <StripeCheckoutConfirm order={order} />
                  )}
                  {isStripeSelected && !stripePromise && (
                    <div className="text-xs text-red-600">Stripe no configurado (env VITE_STRIPE_PUBLISHABLE_KEY faltante).</div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="card-slim p-4">
                <h2 className="text-lg font-medium mb-3">Resumen</h2>
                <div className="divide-y">
                  {items.map(i => (
                    <div key={i.key} className="py-2 flex justify-between text-sm">
                      <span className="truncate mr-2">{i.name} × {i.qty}</span>
                      <span>Bs. {(i.price * i.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs py-1"><span>Subtotal</span><span>Bs. {totals.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs py-1"><span>Envío</span><span>{order ? `Bs. ${Number(order.shipping_cost).toFixed(2)}` : '—'}</span></div>
                <div className="flex justify-between text-xs py-1"><span>Pago</span><span>{order ? `Bs. ${Number(order.payment_fee).toFixed(2)}` : '—'}</span></div>
                <div className="flex justify-between text-sm font-semibold py-2 border-t border-gray-200 mt-2"><span>Total</span><span>{order ? `Bs. ${Number(order.grand_total).toFixed(2)}` : `Bs. ${totals.subtotal.toFixed(2)}`}</span></div>
                <button className="btn-outline-slim w-full mt-2" onClick={() => navigate('/cart')}>Carrito</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
