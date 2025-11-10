import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Mic, 
  MicOff, 
  MessageSquare, 
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronLeft,
  History,
  Search,
  Trash2,
  Plus,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { assistantService, ChatMessage, ChatConversation } from '../../../services/assistantService';
import { useAuth } from '../../../contexts/AuthContext';

interface AIAssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleMinimize: () => void;
  isMinimized: boolean;
}

interface QuickAction {
  label: string;
  url: string;
  icon: string;
}

interface Suggestion {
  text: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

const AIAssistantChat: React.FC<AIAssistantChatProps> = ({ 
  isOpen, 
  onClose, 
  onToggleMinimize,
  isMinimized 
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize Speech Recognition
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    ) {
      const SpeechRecognition =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "es-ES";

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptText;
          } else {
            interimTranscript += transcriptText;
          }
        }

        if (finalTranscript) {
          setInputMessage(prev => prev + ' ' + finalTranscript);
          setTranscript("");
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error", event);
        setIsListening(false);
        let message = "Error en el reconocimiento de voz";

        switch (event?.error) {
          case "not-allowed":
            message = "Permite el acceso al micrófono en tu navegador.";
            break;
          case "audio-capture":
            message = "No se encontró un micrófono disponible.";
            break;
          case "no-speech":
            message = "No se detectó audio. Habla más cerca del micrófono.";
            break;
          case "network":
            message = "Error de conexión. Verifica tu internet.";
            break;
        }

        setVoiceError(message);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setTranscript("");
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setVoiceError("Tu navegador no soporta reconocimiento de voz");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setTranscript('');

    // Add user message immediately to UI
    const tempUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempUserMessage]);
    setIsLoading(true);

    try {
      const response = await assistantService.sendMessage(userMessage, currentConversationId || undefined);
      
      if (response.success) {
        // Update conversation ID if new
        if (response.conversation_id && !currentConversationId) {
          setCurrentConversationId(response.conversation_id);
        }

        // Add assistant message
        const assistantMessage: ChatMessage = {
          id: response.message.id,
          role: 'assistant',
          content: response.message.content,
          suggested_actions: response.message.suggested_actions,
          related_resources: response.message.related_resources,
          created_at: response.message.created_at
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
        created_at: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setInputMessage('');
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      {!isMinimized && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-20 z-40 transition-opacity"
          onClick={onToggleMinimize}
        />
      )}

      {/* Chat Container */}
      <div
        className={`
          fixed right-0 top-0 h-full bg-white shadow-2xl z-50
          transition-all duration-300 ease-in-out
          ${isMinimized ? 'w-16' : 'w-full md:w-[450px]'}
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Minimized State */}
        {isMinimized && (
          <div className="h-full flex flex-col items-center justify-center border-l border-gray-200">
            <button
              onClick={onToggleMinimize}
              className="p-3 hover:bg-gray-100 rounded-lg transition-colors group"
              title="Abrir chat"
            >
              <MessageSquare className="w-6 h-6 text-gray-600 group-hover:text-black transition-colors" />
            </button>
            
            <button
              onClick={onClose}
              className="mt-4 p-3 hover:bg-gray-100 rounded-lg transition-colors group"
              title="Cerrar completamente"
            >
              <X className="w-6 h-6 text-gray-400 group-hover:text-red-500 transition-colors" />
            </button>
          </div>
        )}

        {/* Full Chat State */}
        {!isMinimized && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-black to-gray-800 text-white p-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-wide">ASISTENTE IA</h2>
                    <p className="text-xs text-gray-300">
                      {user?.first_name ? `Hola, ${user.first_name}` : 'Estoy aquí para ayudarte'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={onToggleMinimize}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Minimizar"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Cerrar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-500 max-w-xs">
                    <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-10 h-10 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                      ¡Hola! Soy tu asistente
                    </h3>
                    <p className="text-sm">
                      Pregúntame sobre productos, inventario, ventas o cualquier cosa relacionada con el sistema.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[85%] rounded-2xl p-3 shadow-sm
                        ${message.role === 'user' 
                          ? 'bg-black text-white rounded-br-sm' 
                          : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                        }
                      `}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                      
                      {/* Suggested Actions */}
                      {message.suggested_actions && message.suggested_actions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.suggested_actions.map((action, idx) => (
                            <button
                              key={idx}
                              className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-medium text-gray-700 transition-colors flex items-center gap-2"
                              onClick={() => window.location.href = action.url}
                            >
                              <ChevronRight className="w-3 h-3" />
                              {action.label}
                            </button>
                          ))}
                        </div>
                      )}

                      <span className="text-xs opacity-60 mt-2 block">
                        {new Date(message.created_at).toLocaleTimeString('es-ES', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm p-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                      <span className="text-sm text-gray-500">Escribiendo...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Voice Error */}
            {voiceError && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-100">
                <p className="text-xs text-red-600">{voiceError}</p>
              </div>
            )}

            {/* Transcript Display */}
            {transcript && (
              <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
                <p className="text-xs text-blue-600">
                  <span className="font-medium">Escuchando:</span> {transcript}
                </p>
              </div>
            )}

            {/* Input Container */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center gap-2">
                {/* Voice Input Button */}
                <button
                  onClick={toggleListening}
                  disabled={isLoading}
                  className={`
                    p-3 rounded-lg transition-all flex-shrink-0
                    ${isListening 
                      ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                  title={isListening ? "Detener grabación" : "Grabar mensaje de voz"}
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>

                {/* Text Input */}
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe tu mensaje..."
                  disabled={isLoading}
                  className="
                    flex-1 px-4 py-3 
                    border border-gray-300 rounded-lg
                    focus:outline-none focus:border-black focus:ring-1 focus:ring-black
                    disabled:bg-gray-50 disabled:cursor-not-allowed
                    text-sm
                  "
                />

                {/* Send Button */}
                <button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  className="
                    p-3 bg-black text-white rounded-lg
                    hover:bg-gray-800 
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors flex-shrink-0
                  "
                  title="Enviar mensaje"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>

              {/* New Conversation Button */}
              {messages.length > 0 && (
                <button
                  onClick={startNewConversation}
                  className="w-full mt-2 px-3 py-2 text-xs font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
                >
                  + Nueva conversación
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AIAssistantChat;
