import axiosInstance from './axiosConfig.js';

const salesService = {
  listOrders: async (params = {}) => {
    const res = await axiosInstance.get('/sales/orders/', { params });
    return Array.isArray(res.data) ? res.data : (res.data?.results ?? res.data);
  },
  listOrdersPaged: async (params = {}) => {
    const res = await axiosInstance.get('/sales/orders/', { params });
    return res.data; // expects {results,count,page,page_size} when pagination used
  },
  transition: async (orderId, new_status, reason = '') => {
    const res = await axiosInstance.post(`/sales/orders/${orderId}/transition/`, { new_status, reason });
    return res.data;
  },
  getOrder: async (orderId) => {
    const res = await axiosInstance.get(`/sales/orders/${orderId}/`);
    return res.data;
  },
  listUsers: async (q = '', includeAll = false) => {
    const params = {};
    if (q) params.q = q;
    if (includeAll) params.all = 1;
    const res = await axiosInstance.get('/sales/orders/users/', { params });
    return Array.isArray(res.data) ? res.data : [];
  },
};

export default salesService;
