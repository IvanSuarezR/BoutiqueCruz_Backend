import axiosInstance from './axiosConfig.js';

const unwrap = (data) => (Array.isArray(data) ? data : (data?.results ?? data));

const orderService = {
  start: async (items) => {
    // items: [{ product_id, variant_id?, quantity }]
    const res = await axiosInstance.post('/orders/start/', { items });
    return res.data;
  },
  setAddress: async (orderId, addressId) => {
    const res = await axiosInstance.patch(`/orders/${orderId}/set_address/`, { address_id: addressId });
    return res.data;
  },
  setShipping: async (orderId, shippingMethodId) => {
    const res = await axiosInstance.patch(`/orders/${orderId}/set_shipping_method/`, { shipping_method_id: shippingMethodId });
    return res.data;
  },
  setPayment: async (orderId, paymentMethodId) => {
    const res = await axiosInstance.patch(`/orders/${orderId}/set_payment_method/`, { payment_method_id: paymentMethodId });
    return res.data;
  },
  createStripeIntent: async (orderId) => {
    const res = await axiosInstance.post(`/orders/${orderId}/create_intent/`, {});
    return res.data;
  },
  createStripeCheckout: async (orderId, returnUrl) => {
    const res = await axiosInstance.post(`/orders/${orderId}/create_checkout_session/`, { return_url: returnUrl });
    return res.data; // { id, url }
  },
  confirm: async (orderId, payment_intent_id = null) => {
    const payload = { confirm: true };
    if (payment_intent_id) payload.payment_intent_id = payment_intent_id;
    const res = await axiosInstance.post(`/orders/${orderId}/confirm/`, payload);
    return res.data;
  },
  setCustomer: async (orderId, user_id) => {
    const res = await axiosInstance.patch(`/orders/${orderId}/set_customer/`, { user_id });
    return res.data;
  },
  confirmWithSession: async (orderId, checkout_session_id) => {
    const payload = { confirm: true, checkout_session_id };
    const res = await axiosInstance.post(`/orders/${orderId}/confirm/`, payload);
    return res.data;
  },
  listShipping: async () => {
    const res = await axiosInstance.get('/shipping-methods/');
    return unwrap(res.data);
  },
  listPayment: async () => {
    const res = await axiosInstance.get('/payment-methods/');
    return unwrap(res.data);
  },
  listAddresses: async () => {
    const res = await axiosInstance.get('/addresses/');
    return unwrap(res.data);
  },
  createAddress: async (payload) => {
    const res = await axiosInstance.post('/addresses/', payload);
    return res.data;
  },
  updateAddress: async (id, payload) => {
    const res = await axiosInstance.patch(`/addresses/${id}/`, payload);
    return res.data;
  },
  deleteAddress: async (id) => {
    const res = await axiosInstance.delete(`/addresses/${id}/`);
    return res.data;
  },
  getOrder: async (orderId) => {
    const res = await axiosInstance.get(`/orders/${orderId}/`);
    return res.data;
  },
  updateOrder: async (orderId, payload) => {
    // Generic partial update (e.g., notes)
    const res = await axiosInstance.patch(`/orders/${orderId}/`, payload);
    return res.data;
  },
  // Cart operations
  getCart: async () => {
    const res = await axiosInstance.get('/cart/');
    return res.data;
  },
  addToCart: async (payload) => {
    const res = await axiosInstance.post('/cart/', payload);
    return res.data;
  },
  updateCartItem: async (itemId, payload) => {
    const res = await axiosInstance.patch(`/cart/${itemId}/`, payload);
    return res.data;
  },
  deleteCartItem: async (itemId) => {
    const res = await axiosInstance.delete(`/cart/${itemId}/`);
    return res.data;
  },
  mergeCart: async (payload) => {
    const res = await axiosInstance.post('/cart/merge/', payload);
    return res.data;
  },
  // Preferences
  getPreferences: async () => {
    const res = await axiosInstance.get('/preferences/mine/');
    return res.data;
  },
  updatePreferences: async (payload) => {
    const res = await axiosInstance.patch('/preferences/mine/', payload);
    return res.data;
  },
  listOrders: async () => {
    const res = await axiosInstance.get('/orders/');
    return res.data?.results ? res.data.results : res.data;
  },
  getLatestDraft: async () => {
    try {
      const res = await axiosInstance.get('/orders/draft-latest/');
      if (res.status === 204) return null;
      return res.data;
    } catch (e) { return null; }
  }
};

export default orderService;
