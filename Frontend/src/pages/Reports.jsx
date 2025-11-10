import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import reportsService from '../services/reportsService';
import toast from 'react-hot-toast';
import UserMenu from '../components/common/UserMenu.jsx';
import logo from '../assets/boutiquecruz1.png';

export default function Reports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' o 'history'
  
  // Estado para reportes con IA
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [includeChart, setIncludeChart] = useState(true);
  
  // Estado para reconocimiento de voz
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  
  // Estado para sugerencias
  const [suggestions, setSuggestions] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  // Estado para historial
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Cargar sugerencias al montar
  useEffect(() => {
    loadSuggestions();
    initSpeechRecognition();
  }, []);

  // Inicializar reconocimiento de voz
  const initSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'es-ES';
      
      recognitionInstance.onstart = () => {
        setIsListening(true);
        toast.success('Escuchando... Habla ahora');
      };
      
      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setPrompt(transcript);
        toast.success('Voz transcrita correctamente');
        setShowSuggestions(false);
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'no-speech') {
          toast.error('No se detectó ninguna voz');
        } else if (event.error === 'not-allowed') {
          toast.error('Permiso de micrófono denegado');
        } else {
          toast.error('Error en el reconocimiento de voz');
        }
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    } else {
      console.warn('Speech recognition not supported');
    }
  };

  const startListening = () => {
    if (recognition) {
      try {
        recognition.start();
      } catch (error) {
        console.error('Error starting recognition:', error);
        toast.error('Error al iniciar el reconocimiento de voz');
      }
    } else {
      toast.error('Reconocimiento de voz no disponible en este navegador');
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  // Cargar historial cuando cambia tab
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, historyPage]);

  const loadSuggestions = async () => {
    try {
      const data = await reportsService.getSuggestions();
      setSuggestions(data.suggestions);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await reportsService.getHistory(historyPage, 10);
      setHistory(data.results);
      setHistoryTotal(data.total);
    } catch (error) {
      toast.error('Error al cargar historial');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handlePreview = async () => {
    if (!prompt.trim()) {
      toast.error('Escribe una consulta para el reporte');
      return;
    }

    try {
      setLoading(true);
      setPreviewData(null);
      const data = await reportsService.preview(prompt);
      setPreviewData(data);
      setShowSuggestions(false);
      toast.success(`Vista previa generada: ${data.results_count} resultados`);
    } catch (error) {
      toast.error(error.error || 'Error al generar vista previa');
      console.error('Preview error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Escribe una consulta para el reporte');
      return;
    }

    try {
      setLoading(true);
      const metadata = await reportsService.generate(prompt, exportFormat, includeChart);
      toast.success(`Reporte descargado exitosamente (${metadata.resultsCount} registros)`);
      // Recargar historial
      if (activeTab === 'history') {
        loadHistory();
      }
    } catch (error) {
      toast.error(error.error || 'Error al generar reporte');
      console.error('Generate error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestionText) => {
    setPrompt(suggestionText);
    setShowSuggestions(false);
    setPreviewData(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-BO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="nav-slim">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>  
              <img src={logo} alt="BoutiqueCruz" className="h-12 w-15 object-contain" />
              <h1 className="text-xl font-semibold tracking-wide select-none">BoutiqueCruz</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/dashboard')} className="btn-outline-slim">
                Panel
              </button>
              <button onClick={() => navigate('/')} className="btn-outline-slim">
                Inicio
              </button>
              <span className="text-gray-700 hidden sm:block">
                <strong>{user?.first_name || user?.username}</strong>
              </span>
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-light text-gray-900">Reportes Inteligentes</h1>
          <p className="mt-2 text-sm text-gray-600">
            Genera reportes personalizados usando lenguaje natural
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('ai')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'ai'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Generar Reporte
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'history'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Historial
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'ai' ? (
          <div className="space-y-8">
            {/* Input Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <label className="block text-sm font-medium text-gray-900 mb-3">
                ¿Qué reporte necesitas?
              </label>
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ejemplo: Productos con stock menor a 10 unidades... (o usa el micrófono)"
                  rows={4}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                />
                {/* Botón de micrófono */}
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={loading}
                  className={`absolute right-3 bottom-3 p-2.5 rounded-full transition-all ${
                    isListening
                      ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isListening ? 'Detener grabación' : 'Grabar audio'}
                >
                  {isListening ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Options */}
              <div className="mt-4 flex flex-wrap gap-4 items-center">
                <div className="flex items-center space-x-4">
                  <label className="text-sm text-gray-700">Formato:</label>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
                </div>

                {exportFormat === 'pdf' && (
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeChart}
                      onChange={(e) => setIncludeChart(e.target.checked)}
                      className="rounded border-gray-300 text-black focus:ring-black"
                    />
                    <span className="text-gray-700">Incluir gráfico</span>
                  </label>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handlePreview}
                  disabled={loading || !prompt.trim()}
                  className="px-6 py-2.5 border border-gray-900 text-gray-900 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Generando...' : 'Vista Previa'}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                  className="px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Descargando...' : 'Generar y Descargar'}
                </button>
              </div>
            </div>

            {/* Suggestions */}
            {showSuggestions && suggestions && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Sugerencias de Reportes
                </h3>
                <div className="space-y-6">
                  {Object.entries(suggestions).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                        {category === 'sales' && 'Ventas'}
                        {category === 'inventory' && 'Inventario'}
                        {category === 'financial' && 'Financiero'}
                        {category === 'customers' && 'Clientes'}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {items.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSuggestionClick(item)}
                            className="text-left px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-black hover:shadow-sm transition-all text-sm text-gray-700"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Results */}
            {previewData && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Vista Previa</h3>
                    <p className="text-sm text-gray-600 mt-1">{previewData.explanation}</p>
                  </div>
                  <button
                    onClick={() => {
                      setPreviewData(null);
                      setShowSuggestions(true);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap gap-4 mb-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">Tipo:</span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 capitalize">
                      {previewData.report_type}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">Resultados:</span>
                    <span className="font-medium text-gray-900">{previewData.results_count}</span>
                  </div>
                  {previewData.suggested_chart_type && (
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-500">Gráfico sugerido:</span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-gray-700 capitalize">
                        {previewData.suggested_chart_type}
                      </span>
                    </div>
                  )}
                </div>

                {/* SQL Query */}
                <details className="mb-4">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                    Ver consulta SQL generada
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-50 rounded-lg text-xs overflow-x-auto">
                    {previewData.sql_query}
                  </pre>
                </details>

                {/* Results Table */}
                {previewData.results && previewData.results.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(previewData.results[0]).map((key) => (
                            <th
                              key={key}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewData.results.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {Object.values(row).map((value, vidx) => (
                              <td key={vidx} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                {value !== null ? String(value) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No se encontraron resultados con los criterios especificados
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* History Tab */
          <div className="space-y-4">
            {loadingHistory ? (
              <div className="text-center py-12 text-gray-500">Cargando historial...</div>
            ) : history.length > 0 ? (
              <>
                <div className="space-y-3">
                  {history.map((report) => (
                    <div
                      key={report.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                report.success
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {report.success ? 'Exitoso' : 'Error'}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 capitalize">
                              {report.report_type}
                            </span>
                            <span className="text-xs text-gray-500">{formatDate(report.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-900 mb-1">{report.original_prompt}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>{report.results_count} resultados</span>
                            <span>{report.execution_time?.toFixed(2)}s</span>
                            <span className="uppercase">{report.export_format}</span>
                          </div>
                          {!report.success && report.error_message && (
                            <p className="mt-2 text-xs text-red-600">{report.error_message}</p>
                          )}
                        </div>
                        {report.success && (
                          <button
                            onClick={() => {
                              setPrompt(report.original_prompt);
                              setActiveTab('ai');
                            }}
                            className="ml-4 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                          >
                            Repetir
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {historyTotal > 10 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-gray-700">
                      Mostrando {(historyPage - 1) * 10 + 1} - {Math.min(historyPage * 10, historyTotal)} de{' '}
                      {historyTotal}
                    </p>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => setHistoryPage((p) => p + 1)}
                        disabled={historyPage * 10 >= historyTotal}
                        className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No hay reportes en el historial
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
