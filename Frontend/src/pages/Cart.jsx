import Header from '../components/common/Header.jsx';
import { useCart } from '../context/CartContext.jsx';
import { Link, useNavigate } from 'react-router-dom';

const Cart = () => {
  const { items, updateQty, removeItem, clearCart, totals } = useCart();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-6">Carrito</h1>
        {items.length === 0 ? (
          <div className="text-sm text-gray-600">
            Tu carrito está vacío.{' '}
            <button className="link" onClick={() => navigate('/')}>Seguir comprando</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {items.map(item => {
                const availability = item.availability;
                let badge = null;
                if (availability) {
                  if (availability.status === 'out') badge = <span className="inline-block px-2 py-0.5 text-[10px] bg-red-600 text-white">Sin stock</span>;
                  else if (availability.status === 'partial') badge = <span className="inline-block px-2 py-0.5 text-[10px] bg-amber-500 text-white">Stock parcial ({availability.available})</span>;
                }
                return (
                <div key={item.key} className="border border-gray-200 p-3 flex gap-4">
                  <div className="w-20 h-20 bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden">
                    {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <span className="text-xs text-gray-400">Sin imagen</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm line-clamp-2">{item.name}</div>
                    <div className="mt-1">{badge}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Bs. {item.price.toFixed(2)}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <label className="text-xs text-gray-500">Cantidad:</label>
                      <div className="flex items-center border border-gray-300">
                        <button className="px-2 text-sm" onClick={() => updateQty(item.key, Math.max(1, item.qty - 1))}>-</button>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateQty(item.key, Math.max(1, parseInt(e.target.value,10)||1))}
                          className="w-12 text-center text-sm border-l border-r border-gray-300 py-0.5"
                        />
                        <button className="px-2 text-sm" onClick={() => updateQty(item.key, item.qty + 1)}>+</button>
                      </div>
                      <button className="text-xs text-gray-500 hover:underline" onClick={() => removeItem(item.key)}>Eliminar</button>
                    </div>
                    {(item.selectedSize || item.selectedColor) && (
                      <div className="mt-1 text-xs text-gray-500">
                        {item.selectedSize && <span>Talla: {item.selectedSize}</span>} {item.selectedColor && <span> Color: {item.selectedColor}</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-medium whitespace-nowrap">Bs. {(item.price * item.qty).toFixed(2)}</div>
                  {availability && availability.status === 'partial' && availability.available > 0 && availability.available < item.qty && (
                    <button
                      className="mt-2 text-[10px] underline text-amber-600"
                      onClick={() => updateQty(item.key, availability.available)}
                    >Ajustar a {availability.available}</button>
                  )}
                </div>
                );
              })}
            </div>
            <div className="space-y-4">
              <div className="border border-gray-200 p-4">
                <h2 className="text-lg font-medium mb-3">Resumen</h2>
                <div className="flex justify-between text-sm py-1">
                  <span>Subtotal</span>
                  <span>Bs. {totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm py-1 border-b border-gray-200 pb-2">
                  <span>Envío</span>
                  <span>{totals.subtotal > 0 ? 'Calculado al finalizar' : '—'}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold py-2">
                  <span>Total</span>
                  <span>Bs. {totals.total.toFixed(2)}</span>
                </div>
                <button className="btn btn-primary w-full mt-2" onClick={() => navigate('/checkout')}>Comprar</button>
                <button className="btn-outline-slim w-full mt-2" onClick={clearCart}>Vaciar carrito</button>
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                Los costos de envío e impuestos (si aplican) se calcularán durante el proceso de checkout.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
