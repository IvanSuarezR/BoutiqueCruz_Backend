import axiosInstance from './axiosConfig.js';

const unwrap = (data) => (Array.isArray(data) ? data : (data?.results ?? data));

const inventoryService = {
  getProducts: async (params = {}) => {
    const res = await axiosInstance.get('/inventory/products/', { params });
    return unwrap(res.data);
  },
  getProduct: async (id) => {
    const res = await axiosInstance.get(`/inventory/products/${id}/`);
    return res.data;
  },
  updateProduct: async (id, payload) => {
    const res = await axiosInstance.patch(`/inventory/products/${id}/`, payload);
    return res.data;
  },
  deleteProduct: async (id) => {
    const res = await axiosInstance.delete(`/inventory/products/${id}/`);
    return res.data;
  },
  createProduct: async (payload) => {
    const res = await axiosInstance.post('/inventory/products/', payload);
    return res.data;
  },
  getImagesLibrary: async (params = {}) => {
    const res = await axiosInstance.get('/inventory/products/images_library/', { params });
    return res.data;
  },
  getLibraryImageUsage: async (id) => {
    const res = await axiosInstance.get(`/inventory/products/images-library/${id}/usage/`);
    return res.data;
  },
  deleteLibraryImage: async (id) => {
    const res = await axiosInstance.delete(`/inventory/products/images-library/${id}/`);
    return res.data;
  },
  getCategories: async (params = {}) => {
    const res = await axiosInstance.get('/inventory/categories/', { params });
    return unwrap(res.data);
  },
  getCategory: async (id) => {
    const res = await axiosInstance.get(`/inventory/categories/${id}/`);
    return res.data;
  },
  createCategory: async (payload) => {
    const res = await axiosInstance.post('/inventory/categories/', payload);
    return res.data;
  },
  updateCategory: async (id, payload) => {
    const res = await axiosInstance.patch(`/inventory/categories/${id}/`, payload);
    return res.data;
  },
  deleteCategory: async (id) => {
    const res = await axiosInstance.delete(`/inventory/categories/${id}/`);
    return res.data;
  },
};

export default inventoryService;
