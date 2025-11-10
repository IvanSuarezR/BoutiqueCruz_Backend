/**
 * Servicio para el Asistente Virtual (Chatbot)
 */
import axiosInstance from './axiosConfig.js';

const assistantService = {
  /**
   * Enviar mensaje al chatbot
   * @param {string} message - Mensaje del usuario
   * @param {string} conversationId - ID de la conversación (opcional)
   * @returns {Promise<Object>} Respuesta del asistente
   */
  sendMessage: async (message, conversationId = null) => {
    try {
      const payload = { message };
      if (conversationId) {
        payload.conversation_id = conversationId;
      }
      const response = await axiosInstance.post('/assistant/chat/', payload);
      return response.data;
    } catch (error) {
      console.error('Error sending message to assistant:', error);
      throw error;
    }
  },

  /**
   * Obtener lista de conversaciones del usuario
   * @returns {Promise<Array>} Lista de conversaciones
   */
  getConversations: async () => {
    try {
      const response = await axiosInstance.get('/assistant/conversations/');
      return response.data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  },

  /**
   * Obtener detalle de una conversación específica
   * @param {string} conversationId - ID de la conversación
   * @returns {Promise<Object>} Detalle de la conversación
   */
  getConversationDetail: async (conversationId) => {
    try {
      const response = await axiosInstance.get(`/assistant/conversations/${conversationId}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching conversation detail:', error);
      throw error;
    }
  },

  /**
   * Eliminar una conversación
   * @param {string} conversationId - ID de la conversación
   * @returns {Promise<Object>} Respuesta del servidor
   */
  deleteConversation: async (conversationId) => {
    try {
      const response = await axiosInstance.delete(`/assistant/conversations/${conversationId}/delete/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  },

  /**
   * Enviar feedback sobre una respuesta del asistente
   * @param {string} messageId - ID del mensaje
   * @param {number} rating - Calificación (1-5)
   * @param {string} comment - Comentario opcional
   * @returns {Promise<Object>} Respuesta del servidor
   */
  sendFeedback: async (messageId, rating, comment = '') => {
    try {
      const response = await axiosInstance.post('/assistant/feedback/', {
        message: messageId,
        rating,
        comment,
      });
      return response.data;
    } catch (error) {
      console.error('Error sending feedback:', error);
      throw error;
    }
  },

  /**
   * Obtener acciones rápidas sugeridas
   * @returns {Promise<Array>} Lista de acciones rápidas
   */
  getQuickActions: async () => {
    try {
      const response = await axiosInstance.get('/assistant/quick-actions/');
      return response.data;
    } catch (error) {
      console.error('Error fetching quick actions:', error);
      throw error;
    }
  },

  /**
   * Obtener sugerencias de preguntas
   * @returns {Promise<Array>} Lista de sugerencias
   */
  getSuggestions: async () => {
    try {
      const response = await axiosInstance.get('/assistant/suggestions/');
      return response.data;
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      throw error;
    }
  },
};

export default assistantService;
