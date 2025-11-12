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
  getSalesBySize: async (productId) => {
    const res = await axiosInstance.get(`/inventory/products/${productId}/sales-by-size/`);
    return res.data;
  },
  
  // GCS Gallery endpoints
  getGCSImages: async () => {
    const res = await axiosInstance.get('/inventory/gcs-gallery/');
    return res.data;
  },
  uploadToGCS: async (files, folder = 'gallery') => {
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));
    if (folder) fd.append('folder', folder);
    const res = await axiosInstance.post('/inventory/gcs-gallery/upload/', fd);
    return res.data;
  },
  deleteFromGCS: async (path) => {
    const res = await axiosInstance.delete('/inventory/gcs-gallery/delete/', { data: { path } });
    return res.data;
  },
  createGCSFolder: async (folderName) => {
    const res = await axiosInstance.post('/inventory/gcs-gallery/create-folder/', { folder: folderName });
    return res.data;
  },
  downloadGCSImage: async (imageUrl) => {
    const res = await axiosInstance.post('/inventory/gcs-gallery/download/', { url: imageUrl }, { responseType: 'blob' });
    return res.data; // Returns Blob directly
  },
  
  // Banner management
  getBanner: async () => {
    const res = await axiosInstance.get('/inventory/banner/');
    return res.data;
  },
  updateBanner: async (bannerUrl) => {
    const res = await axiosInstance.post('/inventory/banner/', { banner_url: bannerUrl });
    return res.data;
  },
};

export default inventoryService;
