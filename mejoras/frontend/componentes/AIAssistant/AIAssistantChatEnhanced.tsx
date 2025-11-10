import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Minimize2,
  Send,
  Mic,
  MicOff,
  Loader2,
  Sparkles,
  History,
  Search,
  Trash2,
  Plus,
  Zap,
  ExternalLink,
} from "lucide-react";

import { useAuth } from "../../../contexts/AuthContext";
import {
  assistantService,
  ChatConversation,
} from "../../../services/assistantService";
import { useNavigate } from "react-router-dom";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  suggested_actions?: Array<{ label: string; url: string; icon: string }>;
}

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

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// Helper function to render markdown-like formatting
const renderFormattedText = (text: string) => {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (!line.trim()) {
      elements.push(<div key={`line-${lineIndex}`} className="h-2" />);
      return;
    }

    // Check if it's a numbered list item
    const numberedMatch = line.match(/^(\d+)\.\s*(.+)/);
    if (numberedMatch) {
      const [, number, content] = numberedMatch;
      // Parse bold text in content
      const parts = content.split(/(\*\*[^*]+\*\*)/g);
      const formatted = parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong
              key={`bold-${lineIndex}-${i}`}
              className="font-semibold text-gray-900"
            >
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      elements.push(
        <div
          key={`line-${lineIndex}`}
          className="flex gap-2 mb-2 leading-relaxed"
        >
          <span className="font-semibold text-yellow-500 shrink-0">
            {number}.
          </span>
          <span>{formatted}</span>
        </div>
      );
      return;
    }

    // Check if it's a bullet point
    if (line.trim().startsWith("-") || line.trim().startsWith("•")) {
      const content = line.replace(/^[\s-•]+/, "");
      const parts = content.split(/(\*\*[^*]+\*\*)/g);
      const formatted = parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong
              key={`bold-${lineIndex}-${i}`}
              className="font-semibold text-gray-900"
            >
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      elements.push(
        <div
          key={`line-${lineIndex}`}
          className="flex gap-2 mb-2 leading-relaxed"
        >
          <span className="text-yellow-500 shrink-0">•</span>
          <span>{formatted}</span>
        </div>
      );
      return;
    }

    // Regular line with bold text
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const formatted = parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong
            key={`bold-${lineIndex}-${i}`}
            className="font-semibold text-gray-900"
          >
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    elements.push(
      <div key={`line-${lineIndex}`} className="leading-relaxed mb-1">
        {formatted}
      </div>
    );
  });

  return elements;
};

// Route mapper function
const routeMapper: Record<string, string> = {
  "/inventory": "/admin/products",
  "/employees": "/admin/employees",
  "/reports": "/admin/reports",
  "/pos": "/pos",
  "/profile": "/profile",
};

const mapRoute = (url: string): string => {
  return routeMapper[url] || url;
};

// Icon mapper for quick actions
const getIconComponent = (iconName: string) => {
  const icons: Record<string, any> = {
    package: Sparkles,
    "shopping-cart": Zap,
    "file-text": History,
    users: History,
    user: History,
  };
  const IconComponent = icons[iconName] || Zap;
  return IconComponent;
};

const AIAssistantChatEnhanced: React.FC<AIAssistantChatProps> = ({
  isOpen,
  onClose,
  onToggleMinimize,
  isMinimized,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load conversations on mount
  useEffect(() => {
    if (isOpen && !isMinimized) {
      loadConversations();
      loadQuickActionsAndSuggestions();
    }
  }, [isOpen, isMinimized]);

  const loadConversations = async () => {
    try {
      const conversations = await assistantService.getConversations();
      setConversations(conversations || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  const loadQuickActionsAndSuggestions = async () => {
    try {
      const [actionsRes, suggestionsRes] = await Promise.all([
        assistantService.getQuickActions(),
        assistantService.getSuggestions(),
      ]);
      // The service may return either the raw axios response or already-unwrapped data.
      const actionsData =
        actionsRes && actionsRes.data ? actionsRes.data : actionsRes || {};
      const suggestionsData =
        suggestionsRes && suggestionsRes.data
          ? suggestionsRes.data
          : suggestionsRes || {};

      setQuickActions(actionsData.quick_actions || []);
      setSuggestions(suggestionsData.suggestions || []);
    } catch (error) {
      console.error("Error loading quick actions/suggestions:", error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const conversation =
        await assistantService.getConversation(conversationId);
      const loadedMessages: Message[] = (conversation.messages || []).map(
        (msg: any) => ({
          id: msg.id,
          text: msg.content,
          sender: msg.role === "user" ? "user" : "bot",
          timestamp: new Date(msg.created_at),
          suggested_actions: msg.suggested_actions,
        })
      );
      setMessages(loadedMessages);
      console.log("Loaded conversation ID:", conversationId);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await assistantService.deleteConversation(conversationId);
      loadConversations();
      if (currentConversationId === conversationId) {
        setMessages([]);
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
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
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (final) {
          setInputMessage((prev) => prev + " " + final);
          setInterimTranscript("");
        } else {
          setInterimTranscript(interim);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setInterimTranscript("");

        const errorMessages: Record<string, string> = {
          "not-allowed": "Permiso denegado para usar el micrófono",
          "no-speech": "No se detectó voz",
          "audio-capture": "No se encontró micrófono",
          network: "Error de red",
        };

        setVoiceError(errorMessages[event.error] || "Error al reconocer voz");
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setVoiceError("Reconocimiento de voz no disponible en este navegador");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setVoiceError(null);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        setVoiceError("Error al iniciar el reconocimiento de voz");
      }
    }
  };

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputMessage.trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await assistantService.sendMessage(
        textToSend,
        currentConversationId || undefined
      );
      // Normalize response shape: assistantService may return axios response or already-unwrapped data
      const responseData: any = response && response.data ? response.data : response;

      if (!currentConversationId && responseData.conversation_id) {
        setCurrentConversationId(responseData.conversation_id);
        loadConversations();
      }

      // The backend returns the assistant message under `message` (serialized ChatMessage),
      // but some helpers might return the message object directly. Be defensive.
      const assistantMsgObj: any = responseData.message || responseData;

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text:
          assistantMsgObj.content || assistantMsgObj.response ||
          (typeof assistantMsgObj === 'string' ? assistantMsgObj : ''),
        sender: 'bot',
        timestamp: new Date(),
        suggested_actions: assistantMsgObj.suggested_actions || assistantMsgObj.suggestedActions || [],
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (url: string) => {
    const mappedRoute = mapRoute(url);
    // console.log("Navigating to:", mappedRoute);
    navigate(mappedRoute);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.last_message_preview?.content || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div
      className={`fixed  bg-white shadow-2xl border border-gray-200 transition-all duration-300 ease-in-out z-50 group ${
        isMinimized
          ? "w-14 h-14 rounded-full overflow-visible bottom-6 right-8"
          : showHistory
            ? "w-full md:w-[800px] h-[600px] rounded-2xl bottom-1 right-4"
            : "w-full md:w-[450px] h-[600px] rounded-2xl bottom-1 right-4"
      }`}
    >
      {/* Header */}
      {isMinimized ? (
        // <!-- Componente de la burbuja -->
        <div className="relative inline-block group">
          {/* Botón de cerrar - visible solo en hover (usa group-hover) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-gray-400 text-black rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Burbuja principal - click abre el chat (separa eventos) */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleMinimize();
            }}
            className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-black shadow-lg transition-transform duration-200 group-hover:scale-105"
            title="Abrir chat"
          >
            <Sparkles className="w-6 h-6 text-yellow-500" />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-black rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Asistente IA</h3>
              <p className="text-xs text-gray-300">
                {user?.first_name || "Usuario"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              title="Historial"
            >
              <History className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={onToggleMinimize}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              title="Minimizar"
            >
              <Minimize2 className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}

      {!isMinimized && (
        <div className="flex h-[calc(100%-73px)]">
          {/* Conversation History Sidebar */}
          {showHistory && (
            <div className="w-[280px] border-r border-gray-200 flex flex-col">
              <div className="p-3 border-b border-gray-200">
                <button
                  onClick={startNewConversation}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium mb-3"
                >
                  <Plus className="w-4 h-4 text-yellow-500" />
                  Nueva Conversación
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-black"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    {searchQuery
                      ? "No se encontraron conversaciones"
                      : "No hay conversaciones aún"}
                  </div>
                ) : (
                  <div className="space-y-1 p-2">
                    {filteredConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                          currentConversationId === conv.id
                            ? "bg-blue-50 border border-blue-200"
                            : "hover:bg-gray-50 border border-transparent"
                        }`}
                        onClick={() => loadConversation(conv.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {conv.title}
                            </h4>
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {conv.last_message_preview?.content ||
                                "Sin mensajes"}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(
                                conv.last_message_at
                              ).toLocaleDateString("es-ES", {
                                day: "numeric",
                                month: "short",
                              })}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conv.id);
                            }}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-all"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <div className="p-4 bg-gray-50 rounded-2xl mb-4">
                    <Sparkles className="w-12 h-12 text-yellow-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    ¡Hola! 👋 Soy tu asistente IA
                  </h3>
                  <p className="text-sm text-gray-600 mb-6 max-w-xs">
                    Puedo ayudarte con información sobre productos, ventas,
                    reportes y más.
                  </p>

                  {/* Quick Actions */}
                  {quickActions.length > 0 && (
                    <div className="w-full mb-6">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        Acciones Rápidas
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {quickActions.map((action, index) => {
                          const IconComponent = getIconComponent(action.icon);
                          return (
                            <button
                              key={index}
                              onClick={() => handleQuickAction(action.url)}
                              className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:border-yellow-400 hover:bg-yellow-50 transition-colors text-left text-sm"
                            >
                              <IconComponent className="w-4 h-4 text-yellow-500 shrink-0" />
                              <span className="text-gray-700 font-medium text-xs">
                                {action.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {suggestions.length > 0 && (
                    <div className="w-full">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                        Preguntas Sugeridas
                      </h4>
                      <div className="space-y-2">
                        {suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all text-left text-sm text-gray-700 border border-gray-200"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.sender === "user"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {message.sender === "bot" ? (
                      <div className="text-sm">
                        {renderFormattedText(message.text)}
                      </div>
                    ) : (
                      <p className="text-sm">{message.text}</p>
                    )}

                    {/* Suggested Actions */}
                    {message.suggested_actions &&
                      message.suggested_actions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                          {message.suggested_actions.map((action, idx) => {
                            const IconComponent = getIconComponent(action.icon);
                            return (
                              <button
                                key={idx}
                                onClick={() => handleQuickAction(action.url)}
                                className="flex items-center gap-2 w-full p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors text-left text-xs group"
                              >
                                <IconComponent className="w-3 h-3 text-yellow-500" />
                                <span className="text-gray-700 font-medium flex-1">
                                  {action.label}
                                </span>
                                <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            );
                          })}
                        </div>
                      )}

                    <span
                      className={`text-xs mt-2 block ${
                        message.sender === "user"
                          ? "text-gray-200"
                          : "text-gray-500"
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Voice Error */}
            {voiceError && (
              <div className="mx-4 mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {voiceError}
              </div>
            )}

            {/* Interim Transcript */}
            {interimTranscript && (
              <div className="mx-4 mb-2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 italic">
                {interimTranscript}...
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe tu mensaje..."
                    disabled={isLoading}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:border-black disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
                  />
                  <button
                    onClick={toggleVoiceInput}
                    disabled={isLoading}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all ${
                      isListening
                        ? "bg-red-100 text-red-600 animate-pulse"
                        : "hover:bg-gray-100 text-gray-600"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={
                      isListening ? "Detener grabación" : "Usar entrada de voz"
                    }
                  >
                    {isListening ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="px-5 py-3 bg-gray-900 text-white rounded-xl hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistantChatEnhanced;
