import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Package, 
  RefreshCw, 
  Loader2,
  AlertCircle,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { 
  predictSales, 
  trainSalesForecastModel,
  SalesForecastResponse 
} from '../../../services/mlService';
import AdminNavbar from '../../../components/admin/Navbar/AdminNavbar';

interface PredictionData {
  date: string;
  predicted_sales: number;
  predicted_quantity: number;
  confidence_lower: number;
  confidence_upper: number;
}

const MLPredictionsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [daysAhead, setDaysAhead] = useState(30);
  const [selectedView, setSelectedView] = useState<'7days' | '30days' | 'all'>('30days');

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response: SalesForecastResponse = await predictSales(daysAhead);
      
      if (response.success) {
        setPredictions(response.predictions);
        setSummary(response.summary);
      } else {
        setError('No se pudieron cargar las predicciones. Intenta entrenar el modelo primero.');
      }
    } catch (err: any) {
      console.error('Error loading predictions:', err);
      setError(err.response?.data?.error || 'Error al cargar predicciones. Es posible que debas entrenar el modelo primero.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrainModel = async () => {
    if (!confirm('¿Estás seguro de que deseas entrenar el modelo? Este proceso puede tardar varios minutos.')) {
      return;
    }

    setIsTraining(true);
    setError(null);

    try {
      const result = await trainSalesForecastModel('random_forest');
      
      if (result.success) {
        alert(`Modelo entrenado exitosamente!\n\nMétricas:\n- R² Score: ${result.metrics?.test_r2?.toFixed(4) || 'N/A'}\n- RMSE: ${result.metrics?.test_rmse?.toFixed(2) || 'N/A'}`);
        
        // Recargar predicciones
        await loadPredictions();
      } else {
        setError(result.error || 'Error al entrenar el modelo');
      }
    } catch (err: any) {
      console.error('Error training model:', err);
      setError(err.response?.data?.error || 'Error al entrenar el modelo');
    } finally {
      setIsTraining(false);
    }
  };

  const handleChangeDays = async (days: number) => {
    setDaysAhead(days);
    setIsLoading(true);
    
    try {
      const response: SalesForecastResponse = await predictSales(days);
      
      if (response.success) {
        setPredictions(response.predictions);
        setSummary(response.summary);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al cargar predicciones');
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredPredictions = () => {
    if (selectedView === '7days') {
      return predictions.slice(0, 7);
    } else if (selectedView === '30days') {
      return predictions.slice(0, 30);
    }
    return predictions;
  };

  const calculateTrend = () => {
    if (predictions.length < 2) return 'stable';
    
    const firstWeek = predictions.slice(0, 7).reduce((sum, p) => sum + p.predicted_sales, 0);
    const lastWeek = predictions.slice(-7).reduce((sum, p) => sum + p.predicted_sales, 0);
    
    if (lastWeek > firstWeek * 1.1) return 'up';
    if (lastWeek < firstWeek * 0.9) return 'down';
    return 'stable';
  };

  const filteredPredictions = getFilteredPredictions();
  const trend = calculateTrend();

  return (
    <AdminNavbar>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-black to-gray-700 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                    PREDICCIONES DE VENTAS
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Análisis predictivo con Machine Learning
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleChangeDays(daysAhead)}
                disabled={isLoading}
                className="
                  px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg
                  hover:bg-gray-50 hover:border-gray-400
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all flex items-center gap-2 text-sm font-medium
                "
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                ACTUALIZAR
              </button>
              
              <button
                onClick={handleTrainModel}
                disabled={isTraining}
                className="
                  px-4 py-2.5 bg-black text-white rounded-lg
                  hover:bg-gray-800
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors flex items-center gap-2 text-sm font-semibold uppercase tracking-wide
                "
              >
                {isTraining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    ENTRENANDO...
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    ENTRENAR MODELO
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Total Sales */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-gray-700" />
                  </div>
                  {trend === 'up' ? (
                    <ArrowUpRight className="w-5 h-5 text-green-500" />
                  ) : trend === 'down' ? (
                    <ArrowDownRight className="w-5 h-5 text-red-500" />
                  ) : (
                    <Activity className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  ${summary.total_predicted_sales?.toFixed(2) || '0.00'}
                </div>
                <div className="text-sm text-gray-500">
                  Ventas Totales Predichas ({daysAhead} días)
                </div>
              </div>

              {/* Average Daily */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-gray-700" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  ${summary.avg_daily_sales?.toFixed(2) || '0.00'}
                </div>
                <div className="text-sm text-gray-500">
                  Promedio Diario
                </div>
              </div>

              {/* Total Quantity */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-700" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {summary.total_predicted_quantity || 0}
                </div>
                <div className="text-sm text-gray-500">
                  Unidades Predichas
                </div>
              </div>
            </div>
          )}

          {/* Period Selector */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                Período de Predicción
              </h2>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setSelectedView('7days')}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${selectedView === '7days' 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                Próximos 7 Días
              </button>
              
              <button
                onClick={() => setSelectedView('30days')}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${selectedView === '30days' 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                Próximos 30 Días
              </button>
              
              <button
                onClick={() => setSelectedView('all')}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${selectedView === 'all' 
                    ? 'bg-black text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                Ver Todos ({predictions.length})
              </button>

              <div className="ml-auto flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Días:</label>
                <select
                  value={daysAhead}
                  onChange={(e) => handleChangeDays(parseInt(e.target.value))}
                  className="
                    px-3 py-2 border border-gray-300 rounded-lg text-sm
                    focus:outline-none focus:border-black focus:ring-1 focus:ring-black
                    bg-white
                  "
                >
                  <option value={7}>7 días</option>
                  <option value={15}>15 días</option>
                  <option value={30}>30 días</option>
                  <option value={60}>60 días</option>
                  <option value={90}>90 días</option>
                </select>
              </div>
            </div>
          </div>

          {/* Predictions Table */}
          {isLoading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-gray-400 animate-spin mb-4" />
              <p className="text-gray-500 text-sm">Cargando predicciones...</p>
            </div>
          ) : filteredPredictions.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Ventas Predichas
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Unidades
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Rango de Confianza
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredPredictions.map((prediction, index) => (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(prediction.date).toLocaleDateString('es-ES', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-bold text-gray-900">
                            ${prediction.predicted_sales.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm text-gray-700">
                            {prediction.predicted_quantity} unidades
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-xs text-gray-500">
                            ${prediction.confidence_lower.toFixed(2)} - ${prediction.confidence_upper.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay predicciones disponibles
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Entrena el modelo para generar predicciones de ventas.
              </p>
              <button
                onClick={handleTrainModel}
                disabled={isTraining}
                className="
                  px-6 py-3 bg-black text-white rounded-lg
                  hover:bg-gray-800
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors font-semibold uppercase tracking-wide
                "
              >
                {isTraining ? 'Entrenando...' : 'Entrenar Modelo'}
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminNavbar>
  );
};

export default MLPredictionsPage;
