import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Mic,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Calendar,
  X,
  ArrowLeft,
} from "lucide-react";
import AdminNavbar from "../../components/admin/Navbar/AdminNavbar";
import reportService, {
  DynamicReportPreviewResponse,
  ManualReportPreviewResponse,
  ManualReportFilters,
} from "../../services/reportService";
import { categoryService, Category } from "../../services/productService";

// Tipos para el reconocimiento de voz
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"dynamic" | "manual">("dynamic");

  // REPORTES DINÁMICOS (IA)
  const [dynamicPrompt, setDynamicPrompt] = useState("");
  const [dynamicLoading, setDynamicLoading] = useState(false);
  const [dynamicPreview, setDynamicPreview] =
    useState<DynamicReportPreviewResponse | null>(null);
  const [dynamicError, setDynamicError] = useState("");

  // RECONOCIMIENTO DE VOZ
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // REPORTES MANUALES (Flujo Guiado)
  const [manualStep, setManualStep] = useState<1 | 2 | 3>(1);
  const [selectedReportType, setSelectedReportType] = useState<string>("");
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<
    "year" | "month" | "quarter" | "range" | ""
  >("");

  const [manualFilters, setManualFilters] = useState<ManualReportFilters>({
    report_type: "sales",
    export_format: "pdf",
  });
  const [manualLoading, setManualLoading] = useState(false);
  const [manualPreview, setManualPreview] =
    useState<ManualReportPreviewResponse | null>(null);
  const [manualError, setManualError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  // DESCARGA
  const [downloadFormat, setDownloadFormat] = useState<"pdf" | "excel">("pdf");
  const [downloading, setDownloading] = useState(false);

  // CONFIGURAR RECONOCIMIENTO DE VOZ
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
          setDynamicPrompt(finalTranscript);
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

  useEffect(() => {
    loadCategories();
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setVoiceError("Tu navegador no soporta reconocimiento de voz");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setDynamicPrompt("");
      setTranscript("");
      setVoiceError(null);
      recognitionRef.current.start();
    }
  };

  const handleDynamicPreview = async () => {
    if (!dynamicPrompt.trim()) {
      setDynamicError("Por favor, ingresa una solicitud de reporte");
      return;
    }

    setDynamicLoading(true);
    setDynamicError("");
    setDynamicPreview(null);

    try {
      const preview = await reportService.previewDynamicReport({
        prompt: dynamicPrompt,
        limit: 50,
      });
      setDynamicPreview(preview);
    } catch (error: any) {
      console.error("Error al generar vista previa:", error);
      setDynamicError(
        error.message || "Error al generar la vista previa del reporte"
      );
    } finally {
      setDynamicLoading(false);
    }
  };

  const handleDynamicDownload = async () => {
    if (!dynamicPrompt.trim()) {
      setDynamicError("Por favor, ingresa una solicitud de reporte");
      return;
    }

    setDownloading(true);
    setDynamicError("");

    try {
      const blob = await reportService.generateDynamicReport({
        prompt: dynamicPrompt,
        export_format: downloadFormat,
        include_chart: true,
      });

      reportService.downloadFile(
        blob,
        reportService.getFileName("dinamico", downloadFormat)
      );
    } catch (error: any) {
      console.error("Error al descargar reporte:", error);
      setDynamicError(error.message || "Error al descargar el reporte");
    } finally {
      setDownloading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await categoryService.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Error al cargar categorías:", error);
    }
  };

  const handleSelectReportType = (type: string) => {
    setSelectedReportType(type);
    setManualFilters((prev) => ({
      ...prev,
      report_type: type as any,
    }));
    setManualStep(2);
    setManualPreview(null);
  };

  const handleSelectTimeFilter = (
    filter: "year" | "month" | "quarter" | "range"
  ) => {
    setSelectedTimeFilter(filter);
    // Limpiar TODOS los filtros temporales cuando se cambia el tipo
    const cleanFilters: ManualReportFilters = {
      report_type: manualFilters.report_type,
      export_format: manualFilters.export_format,
    };

    // Mantener solo filtros no temporales
    if (manualFilters.category) cleanFilters.category = manualFilters.category;
    if (manualFilters.min_stock !== undefined)
      cleanFilters.min_stock = manualFilters.min_stock;
    if (manualFilters.max_stock !== undefined)
      cleanFilters.max_stock = manualFilters.max_stock;
    if (manualFilters.status) cleanFilters.status = manualFilters.status;

    setManualFilters(cleanFilters);
    setManualStep(3);
  };

  const handleManualFilterChange = (
    key: keyof ManualReportFilters,
    value: any
  ) => {
    setManualFilters((prev) => {
      const newFilters = { ...prev } as any;

      // Si se está cambiando un filtro temporal, limpiar los otros filtros temporales
      if (
        ["year", "month", "quarter", "start_date", "end_date"].includes(key)
      ) {
        // Limpiar todos los filtros temporales primero
        delete newFilters.year;
        delete newFilters.month;
        delete newFilters.quarter;
        delete newFilters.start_date;
        delete newFilters.end_date;
      }

      // Ahora asignar el nuevo valor
      if (value === undefined || value === "" || value === null) {
        delete newFilters[key];
      } else {
        newFilters[key] = value;
      }

      return newFilters as ManualReportFilters;
    });
    setManualPreview(null);
  };

  const handleManualPreview = async () => {
    setManualLoading(true);
    setManualError("");
    setManualPreview(null);

    try {
      const preview = await reportService.previewManualReport(manualFilters);
      setManualPreview(preview);
    } catch (error: any) {
      console.error("Error al generar vista previa:", error);
      setManualError(
        error.message || "Error al generar la vista previa del reporte"
      );
    } finally {
      setManualLoading(false);
    }
  };

  const handleManualDownload = async () => {
    setDownloading(true);
    setManualError("");

    try {
      const blob = await reportService.generateManualReport({
        ...manualFilters,
        export_format: downloadFormat,
      });

      reportService.downloadFile(
        blob,
        reportService.getFileName(manualFilters.report_type, downloadFormat)
      );
    } catch (error: any) {
      console.error("Error al descargar reporte:", error);
      setManualError(error.message || "Error al descargar el reporte");
    } finally {
      setDownloading(false);
    }
  };

  const resetManualReport = () => {
    setManualStep(1);
    setSelectedReportType("");
    setSelectedTimeFilter("");
    setManualFilters({
      report_type: "sales",
      export_format: "pdf",
    });
    setManualPreview(null);
  };

  return (
    <AdminNavbar>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-8 mt-4">
          {/* Header Minimalista */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1 tracking-tight uppercase">
              Reportes
            </h1>
            <p className="text-sm text-gray-600">
              Genera reportes con IA o mediante filtros personalizados
            </p>
          </div>

          {/* Tabs Minimalistas */}
          <div className="mb-8 border-b border-gray-300">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab("dynamic")}
                className={`pb-3 px-2 font-medium transition-all relative text-sm ${
                  activeTab === "dynamic"
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="uppercase tracking-wide">
                    Reportes con IA
                  </span>
                </div>
                {activeTab === "dynamic" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("manual")}
                className={`pb-3 px-2 font-medium transition-all relative text-sm ${
                  activeTab === "manual"
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="uppercase tracking-wide">
                    Reportes Manuales
                  </span>
                </div>
                {activeTab === "manual" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
                )}
              </button>
            </div>
          </div>

          {/* Contenido según tab activo */}
          {activeTab === "dynamic" ? (
            <DynamicReportsTab
              prompt={dynamicPrompt}
              setPrompt={setDynamicPrompt}
              transcript={transcript}
              isListening={isListening}
              toggleListening={toggleListening}
              voiceError={voiceError}
              loading={dynamicLoading}
              error={dynamicError}
              preview={dynamicPreview}
              downloadFormat={downloadFormat}
              setDownloadFormat={setDownloadFormat}
              downloading={downloading}
              onPreview={handleDynamicPreview}
              onDownload={handleDynamicDownload}
            />
          ) : (
            <ManualReportsTab
              step={manualStep}
              selectedReportType={selectedReportType}
              selectedTimeFilter={selectedTimeFilter}
              filters={manualFilters}
              categories={categories}
              loading={manualLoading}
              error={manualError}
              preview={manualPreview}
              downloadFormat={downloadFormat}
              setDownloadFormat={setDownloadFormat}
              downloading={downloading}
              onSelectReportType={handleSelectReportType}
              onSelectTimeFilter={handleSelectTimeFilter}
              onFilterChange={handleManualFilterChange}
              onPreview={handleManualPreview}
              onDownload={handleManualDownload}
              onReset={resetManualReport}
              onBack={() =>
                setManualStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3)
              }
            />
          )}
        </div>
      </div>
    </AdminNavbar>
  );
};

interface DynamicReportsTabProps {
  prompt: string;
  setPrompt: (value: string) => void;
  transcript: string;
  isListening: boolean;
  toggleListening: () => void;
  voiceError: string | null;
  loading: boolean;
  error: string;
  preview: DynamicReportPreviewResponse | null;
  downloadFormat: "pdf" | "excel";
  setDownloadFormat: (format: "pdf" | "excel") => void;
  downloading: boolean;
  onPreview: () => void;
  onDownload: () => void;
}

const DynamicReportsTab: React.FC<DynamicReportsTabProps> = ({
  prompt,
  setPrompt,
  transcript,
  isListening,
  toggleListening,
  voiceError,
  loading,
  error,
  preview,
  downloadFormat,
  setDownloadFormat,
  downloading,
  onPreview,
  onDownload,
}) => {
  return (
    <div className="space-y-8">
      {/* Input Area */}
      <div className="bg-white border border-gray-300 p-6 rounded-lg">
        <label className="block text-xs font-semibold text-gray-900 mb-3 uppercase tracking-wider">
          Describe el reporte que necesitas
        </label>
        <textarea
          value={prompt || transcript}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ejemplo: Muéstrame las ventas del último mes ordenadas por total"
          className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black resize-none text-sm"
          rows={4}
          disabled={isListening}
        />
        {transcript && (
          <p className="text-xs text-gray-500 mt-2 italic">
            Escuchando: {transcript}
          </p>
        )}
        {voiceError && (
          <div className="flex items-center gap-2 mt-3 text-red-600 text-xs">
            <AlertCircle className="w-4 h-4" />
            <span>{voiceError}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 ">
          <button
            onClick={onPreview}
            disabled={loading || !prompt.trim()}
            className="px-6 py-2.5 bg-white border border-gray-900 text-gray-900 hover:bg-gray-50 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 uppercase text-xs tracking-wider font-medium rounded-md"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            <span>Vista Previa</span>
          </button>

          {/* Botón de Micrófono - DESTACADO */}
          <button
            onClick={toggleListening}
            disabled={loading || downloading}
            className={`relative p-3.5 transition-all duration-200 ${
              isListening
                ? "bg-red-600 hover:bg-red-700 text-white shadow-lg scale-105 rounded-md"
                : "bg-black hover:bg-gray-800 text-white rounded-md"
            } disabled:bg-gray-300 disabled:cursor-not-allowed group`}
            title={
              isListening ? "Detener grabación" : "Iniciar grabación de voz"
            }
          >
            <Mic className={`w-5 h-5 ${isListening ? "animate-pulse" : ""}`} />
            {isListening && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3 ">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 "></span>
              </span>
            )}
          </button>

          <button
            onClick={onDownload}
            disabled={downloading || !prompt.trim()}
            className="px-6 py-2.5 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 uppercase text-xs tracking-wider font-medium rounded-md"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Descargar</span>
          </button>
        </div>

        <div className="flex items-center gap-3 bg-white border border-gray-300 px-4 py-2">
          <span className="text-xs text-gray-600 uppercase tracking-wider font-medium">
            Formato:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setDownloadFormat("pdf")}
              className={`px-3 py-1 text-xs uppercase tracking-wide transition-colors ${
                downloadFormat === "pdf"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              PDF
            </button>
            <button
              onClick={() => setDownloadFormat("excel")}
              className={`px-3 py-1 text-xs uppercase tracking-wide transition-colors ${
                downloadFormat === "excel"
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-300 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <span className="text-red-800 text-sm">{error}</span>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-white border border-gray-300 p-6">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 uppercase tracking-wide">
              Vista Previa
            </h3>
            <span className="text-xs text-gray-600 uppercase bg-gray-100 px-3 py-1">
              {preview.report_type}
            </span>
          </div>

          <p className="text-gray-700 mb-6 text-sm leading-relaxed">
            {preview.explanation}
          </p>

          <div className="mb-4 text-xs text-gray-600">
            <span className="font-semibold">{preview.results_count}</span>{" "}
            resultados encontrados
          </div>

          {preview.results.length > 0 && (
            <div className="border border-gray-300 overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-100">
                  <tr>
                    {Object.keys(preview.results[0]).map((key) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.results.slice(0, 10).map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {Object.values(row).map((value: any, vIdx) => (
                        <td
                          key={vIdx}
                          className="px-4 py-3 text-xs text-gray-900"
                        >
                          {value?.toString() || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.results.length > 10 && (
                <div className="bg-gray-100 px-4 py-3 text-center text-xs text-gray-600">
                  Mostrando 10 de {preview.results_count} resultados
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ManualReportsTabProps {
  step: 1 | 2 | 3;
  selectedReportType: string;
  selectedTimeFilter: "year" | "month" | "quarter" | "range" | "";
  filters: ManualReportFilters;
  categories: Category[];
  loading: boolean;
  error: string;
  preview: ManualReportPreviewResponse | null;
  downloadFormat: "pdf" | "excel";
  setDownloadFormat: (format: "pdf" | "excel") => void;
  downloading: boolean;
  onSelectReportType: (type: string) => void;
  onSelectTimeFilter: (filter: "year" | "month" | "quarter" | "range") => void;
  onFilterChange: (key: keyof ManualReportFilters, value: any) => void;
  onPreview: () => void;
  onDownload: () => void;
  onReset: () => void;
  onBack: () => void;
}

const ManualReportsTab: React.FC<ManualReportsTabProps> = ({
  step,
  selectedReportType,
  selectedTimeFilter,
  filters,
  categories,
  loading,
  error,
  preview,
  downloadFormat,
  setDownloadFormat,
  downloading,
  onSelectReportType,
  onSelectTimeFilter,
  onFilterChange,
  onPreview,
  onDownload,
  onReset,
  onBack,
}) => {
  const reportTypes = [
    { id: "sales", name: "Ventas", description: "Órdenes y montos" },
    { id: "products", name: "Productos", description: "Catálogo y precios" },
    { id: "inventory", name: "Inventario", description: "Stock y valores" },
    {
      id: "categories",
      name: "Categorías",
      description: "Productos por categoría",
    },
    { id: "invoices", name: "Facturas", description: "Facturas generadas" },
    { id: "employees", name: "Empleados", description: "Personal" },
    { id: "customers", name: "Clientes", description: "Base de clientes" },
  ];

  const timeFilters = [
    { id: "year", name: "Por Año", description: "Filtrar por año específico" },
    { id: "month", name: "Por Mes", description: "Filtrar por mes" },
    { id: "quarter", name: "Por Trimestre", description: "Q1, Q2, Q3, Q4" },
    {
      id: "range",
      name: "Rango de Fechas",
      description: "Periodo personalizado",
    },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center gap-3 bg-white border border-gray-300 p-4">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              step >= 1 ? "bg-black text-white" : "bg-gray-200 text-gray-600"
            }`}
          >
            1
          </div>
          <span className="text-xs text-gray-700 uppercase tracking-wide">
            Tipo
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              step >= 2 ? "bg-black text-white" : "bg-gray-200 text-gray-600"
            }`}
          >
            2
          </div>
          <span className="text-xs text-gray-700 uppercase tracking-wide">
            Periodo
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              step >= 3 ? "bg-black text-white" : "bg-gray-200 text-gray-600"
            }`}
          >
            3
          </div>
          <span className="text-xs text-gray-700 uppercase tracking-wide">
            Detalles
          </span>
        </div>
      </div>

      {/* PASO 1: Seleccionar Tipo de Reporte */}
      {step === 1 && (
        <div className="bg-white border border-gray-300 p-6 rounded-lg">
          <h2 className="text-base font-semibold text-gray-900 mb-5 uppercase tracking-wide">
            ¿Qué tipo de reporte necesitas?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ">
            {reportTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => onSelectReportType(type.id)}
                className="border border-gray-300 p-5 hover:border-black hover:bg-gray-50 transition-all text-left group rounded-md"
              >
                <h3 className="text-sm font-semibold text-gray-900 mb-1 uppercase">
                  {type.name}
                </h3>
                <p className="text-xs text-gray-600">{type.description}</p>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-black mt-3 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PASO 2: Seleccionar Filtro Temporal */}
      {step === 2 && (
        <div className="bg-white border border-gray-300 p-6 rounded-md">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-black mb-5 text-xs uppercase tracking-wide"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Volver</span>
          </button>

          <h2 className="text-base font-semibold text-gray-900 mb-2 uppercase tracking-wide">
            Reporte de{" "}
            {reportTypes.find((t) => t.id === selectedReportType)?.name}
          </h2>
          <p className="text-xs text-gray-600 mb-5">
            Selecciona el periodo de tiempo
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {timeFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => onSelectTimeFilter(filter.id as any)}
                className="border border-gray-300 p-5 hover:border-black hover:bg-gray-50 transition-all text-left group rounded-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 uppercase">
                      {filter.name}
                    </h3>
                    <p className="text-xs text-gray-600">
                      {filter.description}
                    </p>
                  </div>
                  <Calendar className="w-4 h-4 text-gray-400 group-hover:text-black transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PASO 3: Detalles y Vista Previa */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white border border-gray-300 p-4 rounded-md">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-black text-xs uppercase tracking-wide"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Volver</span>
            </button>
            <button
              onClick={onReset}
              className="flex items-center gap-2 text-gray-600 hover:text-black text-xs uppercase tracking-wide"
            >
              <X className="w-3 h-3" />
              <span>Reiniciar</span>
            </button>
          </div>

          <div className="bg-white border border-gray-300 p-6 rounded-md">
            <h2 className="text-base font-semibold text-gray-900 mb-5 uppercase tracking-wide">
              Configura los detalles
            </h2>

            {/* Filtros según el tipo de filtro temporal seleccionado */}
            <div className="space-y-5">
              {selectedTimeFilter === "year" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                    Selecciona el año
                  </label>
                  <select
                    value={filters.year || ""}
                    onChange={(e) =>
                      onFilterChange(
                        "year",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedTimeFilter === "month" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                      Año
                    </label>
                    <select
                      value={filters.year || ""}
                      onChange={(e) =>
                        onFilterChange(
                          "year",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                      Mes
                    </label>
                    <select
                      value={filters.month || ""}
                      onChange={(e) =>
                        onFilterChange(
                          "month",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="1">Enero</option>
                      <option value="2">Febrero</option>
                      <option value="3">Marzo</option>
                      <option value="4">Abril</option>
                      <option value="5">Mayo</option>
                      <option value="6">Junio</option>
                      <option value="7">Julio</option>
                      <option value="8">Agosto</option>
                      <option value="9">Septiembre</option>
                      <option value="10">Octubre</option>
                      <option value="11">Noviembre</option>
                      <option value="12">Diciembre</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedTimeFilter === "quarter" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                      Año
                    </label>
                    <select
                      value={filters.year || ""}
                      onChange={(e) =>
                        onFilterChange(
                          "year",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      {years.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                      Trimestre
                    </label>
                    <select
                      value={filters.quarter || ""}
                      onChange={(e) =>
                        onFilterChange("quarter", e.target.value || undefined)
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Q1">Q1 (Enero - Marzo)</option>
                      <option value="Q2">Q2 (Abril - Junio)</option>
                      <option value="Q3">Q3 (Julio - Septiembre)</option>
                      <option value="Q4">Q4 (Octubre - Diciembre)</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedTimeFilter === "range" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      value={filters.start_date || ""}
                      onChange={(e) =>
                        onFilterChange(
                          "start_date",
                          e.target.value || undefined
                        )
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                      Fecha Fin
                    </label>
                    <input
                      type="date"
                      value={filters.end_date || ""}
                      onChange={(e) =>
                        onFilterChange("end_date", e.target.value || undefined)
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Filtros adicionales según tipo de reporte */}
              {(selectedReportType === "products" ||
                selectedReportType === "inventory") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                      Categoría (Opcional)
                    </label>
                    <select
                      value={filters.category || ""}
                      onChange={(e) =>
                        onFilterChange("category", e.target.value || undefined)
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                    >
                      <option value="">Todas las categorías</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                        Stock Mínimo (Opcional)
                      </label>
                      <input
                        type="number"
                        value={filters.min_stock || ""}
                        onChange={(e) =>
                          onFilterChange(
                            "min_stock",
                            e.target.value ? Number(e.target.value) : undefined
                          )
                        }
                        placeholder="0"
                        className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                        Stock Máximo (Opcional)
                      </label>
                      <input
                        type="number"
                        value={filters.max_stock || ""}
                        onChange={(e) =>
                          onFilterChange(
                            "max_stock",
                            e.target.value ? Number(e.target.value) : undefined
                          )
                        }
                        placeholder="1000"
                        className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {(selectedReportType === "sales" ||
                selectedReportType === "invoices") && (
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">
                    Estado (Opcional)
                  </label>
                  <select
                    value={filters.status || ""}
                    onChange={(e) =>
                      onFilterChange("status", e.target.value || undefined)
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 focus:outline-none focus:border-black text-sm"
                  >
                    <option value="">Todos los estados</option>
                    <option value="pending">Pendiente</option>
                    <option value="completed">Completado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-300">
              <div className="flex items-center gap-3">
                <button
                  onClick={onPreview}
                  disabled={loading}
                  className="px-6 py-2.5 bg-white border border-gray-900 text-gray-900 hover:bg-gray-50 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 uppercase text-xs tracking-wider font-medium rounded-md"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  <span>Vista Previa</span>
                </button>

                <button
                  onClick={onDownload}
                  disabled={downloading}
                  className="px-6 py-2.5 bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 uppercase text-xs tracking-wider font-medium rounded-md"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Descargar</span>
                </button>
              </div>

              <div className="flex items-center gap-3 bg-gray-50 border border-gray-300 px-4 py-2">
                <span className="text-xs text-gray-600 uppercase tracking-wider font-medium">
                  Formato:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDownloadFormat("pdf")}
                    className={`px-3 py-1 text-xs uppercase tracking-wide transition-colors ${
                      downloadFormat === "pdf"
                        ? "bg-black text-white"
                        : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                    }`}
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => setDownloadFormat("excel")}
                    className={`px-3 py-1 text-xs uppercase tracking-wide transition-colors ${
                      downloadFormat === "excel"
                        ? "bg-black text-white"
                        : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                    }`}
                  >
                    Excel
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-300 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="bg-white border border-gray-300 p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 uppercase tracking-wide">
                  Vista Previa
                </h3>
                <span className="text-xs text-gray-600 uppercase bg-gray-100 px-3 py-1">
                  {preview.report_type}
                </span>
              </div>

              <p className="text-gray-700 mb-6 text-sm leading-relaxed">
                {preview.summary}
              </p>

              <div className="mb-4 text-xs text-gray-600">
                <span className="font-semibold">{preview.total}</span>{" "}
                resultados encontrados
              </div>

              {preview.filters_applied.length > 0 && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {preview.filters_applied.map((filter, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-xs border border-gray-200"
                    >
                      {filter}
                    </span>
                  ))}
                </div>
              )}

              {preview.results.length > 0 && (
                <div className="border border-gray-300 overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        {Object.keys(preview.results[0]).map((key) => (
                          <th
                            key={key}
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preview.results.slice(0, 10).map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          {Object.values(row).map((value: any, vIdx) => (
                            <td
                              key={vIdx}
                              className="px-4 py-3 text-xs text-gray-900"
                            >
                              {value?.toString() || "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.results.length > 10 && (
                    <div className="bg-gray-100 px-4 py-3 text-center text-xs text-gray-600">
                      Mostrando 10 de {preview.total} resultados
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
