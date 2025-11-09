import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

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
  useEffect(() => {
    try {
      localStorage.setItem('cart_v1', JSON.stringify({ items: state.items }));
    } catch {}
  }, [state.items]);

  const addItem = (product, opts = {}) => dispatch({ type: 'ADD', payload: { product, ...opts } });
  const updateQty = (key, qty) => dispatch({ type: 'UPDATE_QTY', payload: { key, qty } });
  const removeItem = (key) => dispatch({ type: 'REMOVE', payload: { key } });
  const clearCart = () => dispatch({ type: 'CLEAR' });

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
