import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import assistantService from '../../services/assistantService.js';
import toast from 'react-hot-toast';

const ChatAssistant = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll al final de los mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus en el input cuando se abre el chat
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Cargar conversaciones y sugerencias al abrir
  useEffect(() => {
    if (isOpen && !isMinimized && isAuthenticated) {
      loadConversations();
      loadSuggestions();
    }
  }, [isOpen, isMinimized, isAuthenticated]);

  // Mensaje de bienvenida
  useEffect(() => {
    if (isOpen && messages.length === 0 && isAuthenticated) {
      const welcomeMessage = {
        role: 'assistant',
        content: `¡Hola${user?.first_name ? ` ${user.first_name}` : ''}! 👋 Soy tu asistente virtual de Boutique Cruz. ¿En qué puedo ayudarte hoy?`,
        created_at: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, isAuthenticated, user]);

  // Inicializar reconocimiento de voz
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'es-ES';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (final) {
          setInputMessage((prev) => (prev + ' ' + final).trim());
          setInterimTranscript('');
        } else {
          setInterimTranscript(interim);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setInterimTranscript('');
        
        const errorMessages = {
          'not-allowed': 'Permiso denegado para usar el micrófono',
          'no-speech': 'No se detectó voz',
          'audio-capture': 'No se encontró micrófono',
          'network': 'Error de red',
        };
        
        toast.error(errorMessages[event.error] || 'Error al reconocer voz');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const loadConversations = async () => {
    try {
      const convos = await assistantService.getConversations();
      setConversations(convos || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const result = await assistantService.getSuggestions();
      setSuggestions(result?.suggestions || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const loadConversation = async (convId) => {
    try {
      const conversation = await assistantService.getConversationDetail(convId);
      const loadedMessages = (conversation.messages || []).map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at,
        suggested_actions: msg.suggested_actions,
      }));
      setMessages(loadedMessages);
      setConversationId(convId);
      setShowHistory(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Error al cargar la conversación');
    }
  };

  const deleteConversation = async (convId) => {
    try {
      await assistantService.deleteConversation(convId);
      loadConversations();
      if (conversationId === convId) {
        setMessages([]);
        setConversationId(null);
      }
      toast.success('Conversación eliminada');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Error al eliminar la conversación');
    }
  };

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      toast.error('Reconocimiento de voz no disponible en este navegador');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        toast.error('Error al iniciar el reconocimiento de voz');
      }
    }
  };

  const handleSendMessage = async (messageText) => {
    const textToSend = messageText || inputMessage.trim();
    if (!textToSend || loading) return;

    const userMessage = {
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await assistantService.sendMessage(textToSend, conversationId);
      
      if (response.success) {
        // Guardar conversation_id si es una conversación nueva
        if (response.conversation_id && !conversationId) {
          setConversationId(response.conversation_id);
        }

        // Agregar respuesta del asistente
        setMessages((prev) => [...prev, response.message]);
      } else {
        throw new Error(response.error || 'Error al procesar el mensaje');
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      toast.error('No pude procesar tu mensaje. Intenta de nuevo.');
      
      // Mensaje de error del asistente
      const errorMessage = {
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta nuevamente.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    const welcomeMessage = {
      role: 'assistant',
      content: `¡Hola${user?.first_name ? ` ${user.first_name}` : ''}! 👋 ¿En qué más puedo ayudarte?`,
      created_at: new Date().toISOString(),
    };
    setMessages([welcomeMessage]);
    setShowHistory(false);
  };

  const handleActionClick = (url) => {
    if (url && url !== '#') {
      navigate(url);
      setIsOpen(false);
    }
  };

  // Renderizar texto formateado (bold, listas, etc.)
  const renderFormattedText = (text) => {
    const lines = text.split('\n');
    const elements = [];

    lines.forEach((line, lineIndex) => {
      if (!line.trim()) {
        elements.push(<div key={`line-${lineIndex}`} className="h-2" />);
        return;
      }

      // Lista numerada
      const numberedMatch = line.match(/^(\d+)\.\s*(.+)/);
      if (numberedMatch) {
        const [, number, content] = numberedMatch;
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        const formatted = parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={`bold-${lineIndex}-${i}`} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        elements.push(
          <div key={`line-${lineIndex}`} className="flex gap-2 mb-2">
            <span className="font-semibold text-gray-900 shrink-0">{number}.</span>
            <span>{formatted}</span>
          </div>
        );
        return;
      }

      // Lista con bullets
      if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('✅') || line.trim().startsWith('❌')) {
        const content = line.replace(/^[\s-•✅❌]+/, '');
        const bullet = line.trim()[0];
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        const formatted = parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={`bold-${lineIndex}-${i}`} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        elements.push(
          <div key={`line-${lineIndex}`} className="flex gap-2 mb-2">
            <span className="shrink-0">{bullet === '✅' || bullet === '❌' ? bullet : '•'}</span>
            <span>{formatted}</span>
          </div>
        );
        return;
      }

      // Línea normal con bold
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const formatted = parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={`bold-${lineIndex}-${i}`} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      elements.push(
        <div key={`line-${lineIndex}`} className="mb-1">
          {formatted}
        </div>
      );
    });

    return elements;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-black text-white p-4 rounded-full shadow-lg hover:bg-gray-800 transition-all duration-300 border border-gray-700 group"
          title="Asistente IA"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6 group-hover:scale-110 transition-transform"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
        </button>
      )}

      {/* Ventana del chat */}
      {isOpen && (
        <div 
          className={`fixed  z-50 bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col transition-all duration-300 ${
            isMinimized ? 'w-[400px] h-[60px] bottom-6 right-6' : 'w-[400px] h-[600px] bottom-0.5 right-2'
          }`}
        >
          {/* Header */}
          <div className="bg-black text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
              <span className="font-medium text-sm">Asistente IA</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-white hover:text-gray-300 transition-colors"
                title="Historial"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                onClick={handleNewConversation}
                className="text-white hover:text-gray-300 transition-colors"
                title="Nueva conversación"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white hover:text-gray-300 transition-colors"
                title={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:text-gray-300 transition-colors"
                title="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Contenido principal */}
              {showHistory ? (
                /* Historial de conversaciones */
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                  <h3 className="text-sm font-semibold mb-3">Conversaciones anteriores</h3>
                  {conversations.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay conversaciones previas</p>
                  ) : (
                    <div className="space-y-2">
                      {conversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="bg-white border border-gray-200 rounded-lg p-3 hover:border-black transition-colors cursor-pointer group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1" onClick={() => loadConversation(conv.id)}>
                              <p className="text-sm font-medium line-clamp-1">{conv.title || 'Sin título'}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(conv.last_message_at).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                              title="Eliminar"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Mensajes */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {/* Sugerencias iniciales */}
                    {messages.length <= 1 && suggestions.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Sugerencias:</p>
                        <div className="space-y-2">
                          {suggestions.map((suggestion, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSendMessage(suggestion)}
                              className="w-full text-left text-sm text-gray-700 hover:text-black hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                            >
                              💡 {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-2 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-black text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}
                        >
                          <div className="text-sm whitespace-pre-wrap">
                            {renderFormattedText(msg.content)}
                          </div>
                          
                          {/* Acciones sugeridas */}
                          {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                              {msg.suggested_actions.map((action, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleActionClick(action.url)}
                                  className="flex items-center gap-2 w-full text-left text-xs text-gray-600 hover:text-black hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                                >
                                  <span>🔗</span>
                                  <span>{action.label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {loading && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span className="text-xs text-gray-500">Escribiendo...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
                    {/* Transcripción temporal */}
                    {interimTranscript && (
                      <div className="mb-2 text-xs text-gray-500 italic">
                        Escuchando: {interimTranscript}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Escribe tu mensaje..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-black text-sm"
                        disabled={loading}
                      />
                      <button
                        onClick={toggleVoiceInput}
                        disabled={loading}
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          isListening
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={isListening ? 'Detener' : 'Grabar audio'}
                      >
                        {isListening ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => handleSendMessage()}
                        disabled={loading || !inputMessage.trim()}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Presiona Enter para enviar • {recognitionRef.current ? 'Mic disponible' : 'Mic no disponible'}
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatAssistant;
