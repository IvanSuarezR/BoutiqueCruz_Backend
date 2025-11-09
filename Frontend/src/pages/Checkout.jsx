import Header from '../components/common/Header.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';

const Checkout = () => {
  const { items, totals, clearCart } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const placeOrder = async () => {
    setSubmitting(true);
    // Placeholder: aquí iría la integración real (crear orden en backend, pago, etc.)
    setTimeout(() => {
      clearCart();
      navigate('/');
    }, 800);
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
              <div className="card-slim p-4">
                <h2 className="text-lg font-medium mb-3">Datos de envío</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="border p-2 rounded-none" placeholder="Nombre" />
                  <input className="border p-2 rounded-none" placeholder="Apellido" />
                  <input className="border p-2 rounded-none md:col-span-2" placeholder="Dirección" />
                  <input className="border p-2 rounded-none" placeholder="Ciudad" />
                  <input className="border p-2 rounded-none" placeholder="Teléfono" />
                </div>
              </div>
              <div className="card-slim p-4">
                <h2 className="text-lg font-medium mb-3">Método de pago</h2>
                <p className="text-sm text-gray-600">(Demostración) El pago se coordinará por WhatsApp o transferencia.</p>
              </div>
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
                <div className="flex justify-between text-sm py-2 border-t border-gray-200 mt-2">
                  <span>Subtotal</span>
                  <span>Bs. {totals.subtotal.toFixed(2)}</span>
                </div>
                <button className="btn btn-primary w-full mt-3" onClick={placeOrder} disabled={submitting}>
                  {submitting ? 'Procesando…' : 'Realizar pedido'}
                </button>
                <button className="btn-outline-slim w-full mt-2" onClick={() => navigate('/cart')}>Volver al carrito</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
