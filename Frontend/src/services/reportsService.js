/**
 * Servicio para el módulo de Reportes con IA
 */
import axiosInstance from './axiosConfig.js';

const reportsService = {
  /**
   * Vista previa de reporte (JSON) sin descargar archivo
   * @param {string} prompt - Prompt en lenguaje natural
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Object>} Vista previa con SQL y resultados
   */
  preview: async (prompt, limit = 50) => {
    try {
      const response = await axiosInstance.post('/reports/preview/', {
        prompt,
        limit,
      });
      return response.data;
    } catch (error) {
      console.error('Error previewing report:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Generar y descargar reporte completo (PDF o Excel)
   * @param {string} prompt - Prompt en lenguaje natural
   * @param {string} exportFormat - 'pdf' o 'excel'
   * @param {boolean} includeChart - Incluir gráfico en PDF
   * @returns {Promise<Blob>} Archivo descargable
   */
  generate: async (prompt, exportFormat = 'pdf', includeChart = true) => {
    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('export_format', exportFormat);
      formData.append('include_chart', includeChart ? 'true' : 'false');

      const response = await axiosInstance.post('/reports/generate/', formData, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Extraer metadata de headers
      const metadata = {
        reportId: response.headers['x-report-id'],
        executionTime: response.headers['x-execution-time'],
        resultsCount: response.headers['x-results-count'],
      };

      // Descargar archivo
      const contentDisposition = response.headers['content-disposition'];
      let filename = `reporte_${Date.now()}.${exportFormat === 'excel' ? 'xlsx' : 'pdf'}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return metadata;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Obtener historial de reportes generados
   * @param {number} page - Número de página
   * @param {number} pageSize - Tamaño de página
   * @param {string} type - Filtrar por tipo (opcional)
   * @param {boolean} successOnly - Solo reportes exitosos
   * @returns {Promise<Object>} Historial paginado
   */
  getHistory: async (page = 1, pageSize = 20, type = null, successOnly = false) => {
    try {
      const params = { page, page_size: pageSize };
      if (type) params.type = type;
      if (successOnly) params.success_only = 'true';

      const response = await axiosInstance.get('/reports/history/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching report history:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Obtener sugerencias de reportes comunes
   * @returns {Promise<Object>} Sugerencias categorizadas
   */
  getSuggestions: async () => {
    try {
      const response = await axiosInstance.get('/reports/suggestions/');
      return response.data;
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Vista previa de reporte manual con filtros tradicionales
   * @param {Object} params - Parámetros de filtros
   * @returns {Promise<Object>} Vista previa
   */
  manualPreview: async (params) => {
    try {
      const response = await axiosInstance.get('/reports/manual/preview/', { params });
      return response.data;
    } catch (error) {
      console.error('Error previewing manual report:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Generar reporte manual con filtros
   * @param {Object} params - Parámetros de filtros
   * @returns {Promise<Object>} Metadata del archivo descargado
   */
  manualGenerate: async (params) => {
    try {
      const response = await axiosInstance.get('/reports/manual/generate/', {
        params,
        responseType: 'blob',
      });

      // Descargar archivo
      const contentDisposition = response.headers['content-disposition'];
      let filename = `reporte_manual_${Date.now()}.${params.export_format === 'excel' ? 'xlsx' : 'pdf'}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return {
        executionTime: response.headers['x-execution-time'],
        resultsCount: response.headers['x-results-count'],
      };
    } catch (error) {
      console.error('Error generating manual report:', error);
      throw error.response?.data || error;
    }
  },
};

export default reportsService;
