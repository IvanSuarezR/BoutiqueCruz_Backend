import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import orderService from '../services/orderService.js';
import { useAuth } from './AuthContext.jsx';
import toast from 'react-hot-toast';

// Each cart line: { id, name, price, image, qty, sizes:[], selectedSize, colors:[], selectedColor }
// id corresponds to product id (assumption: unique); optional variant key can be appended later.

const CartContext = createContext(null);

const initialState = {
  items: [], // array of line items
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'INIT': {
      return { ...state, items: action.payload.items || [] };
    }
    case 'ADD': {
      const { product, qty = 1, selectedSize, selectedColor } = action.payload;
      if (!product || !product.id) return state;
      // key strategy: product id + size + color
      const key = `${product.id}::${selectedSize || ''}::${selectedColor || ''}`;
      const existingIdx = state.items.findIndex(i => i.key === key);
      let items;
      if (existingIdx >= 0) {
        items = state.items.map((i, idx) => idx === existingIdx ? { ...i, qty: i.qty + qty } : i);
      } else {
        items = [...state.items, {
          key,
          id: product.id,
          name: product.name,
          price: Number(product.price) || 0,
          image: product.image || null,
          qty,
          selectedSize: selectedSize || null,
          selectedColor: selectedColor || null,
          sizes: Array.isArray(product.sizes) ? product.sizes : [],
          colors: Array.isArray(product.colors) ? product.colors : (product.color ? [product.color] : []),
          stock: product.stock,
        }];
      }
      return { ...state, items };
    }
    case 'UPDATE_QTY': {
      const { key, qty } = action.payload;
      if (qty <= 0) {
        return { ...state, items: state.items.filter(i => i.key !== key) };
      }
      return { ...state, items: state.items.map(i => i.key === key ? { ...i, qty } : i) };
    }
    case 'REMOVE': {
      const { key } = action.payload;
      return { ...state, items: state.items.filter(i => i.key !== key) };
    }
    case 'CLEAR': {
      return { ...state, items: [] };
    }
    default:
      return state;
  }
}

export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Load from localStorage once
  const { isAuthenticated } = useAuth();
  const mergedOnLoginRef = useRef(false);

  // Load local cart initially (for anonymous browsing)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cart_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        dispatch({ type: 'INIT', payload: { items: Array.isArray(parsed.items) ? parsed.items : [] } });
      }
    } catch {}
  }, []);

  // Persist
  // Persist locally for anonymous users only
  useEffect(() => {
    if (!isAuthenticated) {
      try { localStorage.setItem('cart_v1', JSON.stringify({ items: state.items })); } catch {}
    }
  }, [state.items, isAuthenticated]);

  // On authentication, fetch server cart and merge local items (once)
  useEffect(() => {
    const syncServerCart = async () => {
      if (!isAuthenticated) return;
      // Fetch server cart
      try {
        const server = await orderService.getCart();
        const serverItems = Array.isArray(server.items) ? server.items : [];
        // If we haven't merged yet and have local items, send them to server via merge
        try {
          if (!mergedOnLoginRef.current && state.items.length) {
            const payload = {
              items: state.items.map(i => ({
                product_id: i.id,
                quantity: i.qty,
                size_label: i.selectedSize || null,
              }))
            };
            await orderService.mergeCart(payload);
            mergedOnLoginRef.current = true;
            // refetch cart after merge
            const refreshed = await orderService.getCart();
            const refreshedItems = Array.isArray(refreshed.items) ? refreshed.items : [];
            const normalized = refreshedItems.map(ci => ({
              key: `${ci.product}::${ci.variant_size || ''}::${ci.size_label || ''}`,
              id: ci.product,
              name: ci.product_name,
              price: Number(ci.product_price) || 0,
              image: ci.product_image_url || null,
              qty: ci.quantity,
              selectedSize: ci.size_label || ci.variant_size || null,
              selectedColor: null,
              sizes: [],
              colors: [],
              stock: ci.availability?.available ?? 0,
              availability: ci.availability,
              variantId: ci.variant || null,
            }));
            dispatch({ type: 'INIT', payload: { items: normalized } });
            return;
          }
        } catch (e) {
          toast.error('No se pudo fusionar el carrito');
        }
        // If no local items or already merged, just replace with server
        const normalized = serverItems.map(ci => ({
          key: `${ci.product}::${ci.variant_size || ''}::${ci.size_label || ''}`,
          id: ci.product,
          name: ci.product_name,
          price: Number(ci.product_price) || 0,
          image: ci.product_image_url || null,
          qty: ci.quantity,
          selectedSize: ci.size_label || ci.variant_size || null,
          selectedColor: null,
          sizes: [],
          colors: [],
          stock: ci.availability?.available ?? 0,
          availability: ci.availability,
          variantId: ci.variant || null,
        }));
        dispatch({ type: 'INIT', payload: { items: normalized } });
      } catch (e) {
        toast.error('Error cargando carrito');
      }
    };
    syncServerCart();
  }, [isAuthenticated]);

  const addItem = async (product, opts = {}) => {
    const { qty = 1, selectedSize } = opts;
    if (isAuthenticated) {
      try {
        await orderService.addToCart({ product_id: product.id, quantity: qty, size_label: selectedSize || null });
        const server = await orderService.getCart();
        const serverItems = Array.isArray(server.items) ? server.items : [];
        const normalized = serverItems.map(ci => ({
          key: `${ci.product}::${ci.variant_size || ''}::${ci.size_label || ''}`,
          id: ci.product,
          name: ci.product_name,
          price: Number(ci.product_price) || 0,
          image: ci.product_image_url || null,
          qty: ci.quantity,
          selectedSize: ci.size_label || ci.variant_size || null,
          selectedColor: null,
          sizes: [],
          colors: [],
          stock: ci.availability?.available ?? 0,
          availability: ci.availability,
          variantId: ci.variant || null,
        }));
        dispatch({ type: 'INIT', payload: { items: normalized } });
        return;
      } catch (e) {
        toast.error('No se pudo agregar al carrito');
        return;
      }
    }
    dispatch({ type: 'ADD', payload: { product, ...opts } });
  };
  const updateQty = async (key, qty) => {
    if (isAuthenticated) {
      const item = state.items.find(i => i.key === key);
      if (!item) return;
      try {
        // find matching server item by product + size label
        const server = await orderService.getCart();
        const serverItem = (server.items || []).find(ci => ci.product === item.id && (ci.size_label || '') === (item.selectedSize || ''));
        if (serverItem) {
          await orderService.updateCartItem(serverItem.id, { quantity: qty });
          const refreshed = await orderService.getCart();
          const normalized = (refreshed.items || []).map(ci => ({
            key: `${ci.product}::${ci.variant_size || ''}::${ci.size_label || ''}`,
            id: ci.product,
            name: ci.product_name,
            price: Number(ci.product_price) || 0,
            image: ci.product_image_url || null,
            qty: ci.quantity,
            selectedSize: ci.size_label || ci.variant_size || null,
            selectedColor: null,
            sizes: [],
            colors: [],
            stock: ci.availability?.available ?? 0,
            availability: ci.availability,
            variantId: ci.variant || null,
          }));
          dispatch({ type: 'INIT', payload: { items: normalized } });
          return;
        }
      } catch (e) {
        toast.error('Error actualizando cantidad');
        return;
      }
    }
    dispatch({ type: 'UPDATE_QTY', payload: { key, qty } });
  };
  const removeItem = async (key) => {
    if (isAuthenticated) {
      const item = state.items.find(i => i.key === key);
      if (!item) return;
      try {
        const server = await orderService.getCart();
        const serverItem = (server.items || []).find(ci => ci.product === item.id && (ci.size_label || '') === (item.selectedSize || ''));
        if (serverItem) {
          await orderService.deleteCartItem(serverItem.id);
          const refreshed = await orderService.getCart();
          const normalized = (refreshed.items || []).map(ci => ({
            key: `${ci.product}::${ci.variant_size || ''}::${ci.size_label || ''}`,
            id: ci.product,
            name: ci.product_name,
            price: Number(ci.product_price) || 0,
            image: ci.product_image_url || null,
            qty: ci.quantity,
            selectedSize: ci.size_label || ci.variant_size || null,
            selectedColor: null,
            sizes: [],
            colors: [],
            stock: ci.availability?.available ?? 0,
            availability: ci.availability,
            variantId: ci.variant || null,
          }));
          dispatch({ type: 'INIT', payload: { items: normalized } });
          return;
        }
      } catch (e) {
        toast.error('Error eliminando item');
        return;
      }
    }
    dispatch({ type: 'REMOVE', payload: { key } });
  };
  const clearCart = async () => {
    if (isAuthenticated) {
      try {
        const server = await orderService.getCart();
        const ids = (server.items || []).map(ci => ci.id);
        for (const id of ids) {
          try { await orderService.deleteCartItem(id); } catch {}
        }
        dispatch({ type: 'CLEAR' });
        return;
      } catch {}
    }
    dispatch({ type: 'CLEAR' });
  };

  const totals = useMemo(() => {
    const subtotal = state.items.reduce((sum, i) => sum + i.price * i.qty, 0);
    // Taxes / shipping placeholder
    const shipping = subtotal > 0 ? 0 : 0;
    const total = subtotal + shipping; // extend later
    return { subtotal, shipping, total };
  }, [state.items]);

  const value = {
    items: state.items,
    addItem,
    updateQty,
    removeItem,
    clearCart,
    totals,
    count: state.items.reduce((sum, i) => sum + i.qty, 0),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
};

export default CartContext;
