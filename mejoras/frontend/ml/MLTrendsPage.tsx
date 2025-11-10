import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown,
  Loader2,
  AlertCircle,
  RefreshCw,
  Boxes,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  analyzeInventory,
  getInventoryHealth,
  getInventoryAlerts,
  resolveInventoryAlert,
  InventoryAnalysisResponse,
  InventoryAlert
} from '../../../services/mlService';
import AdminNavbar from '../../../components/admin/Navbar/AdminNavbar';

const MLTrendsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<InventoryAnalysisResponse | null>(null);
  const [healthScore, setHealthScore] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlertType, setSelectedAlertType] = useState<string>('all');
  const [resolvingAlerts, setResolvingAlerts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [analysisResponse, healthResponse] = await Promise.all([
        analyzeInventory(),
        getInventoryHealth()
      ]);
      
      if (analysisResponse.success) {
        setAnalysis(analysisResponse);
      }
      
      if (healthResponse.success) {
        setHealthScore(healthResponse);
      }
    } catch (err: any) {
      console.error('Error loading analysis:', err);
      setError(err.response?.data?.error || 'Error al cargar análisis de inventario');
    } finally {
      setIsLoading(false);
    }
  };

  const getAlertTypeColor = (alertType: string) => {
    switch (alertType) {
      case 'low_stock':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'overstock':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'no_movement':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'reorder_point':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getUrgencyColor = (urgency: number) => {
    if (urgency >= 8) return 'text-red-600 bg-red-50';
    if (urgency >= 5) return 'text-orange-600 bg-orange-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return <CheckCircle2 className="w-8 h-8 text-green-500" />;
    if (score >= 60) return <AlertTriangle className="w-8 h-8 text-yellow-500" />;
    return <AlertCircle className="w-8 h-8 text-red-500" />;
  };

  const handleResolveAlert = async (alertId: string) => {
    if (!confirm('¿Estás seguro de que deseas marcar esta alerta como resuelta?')) {
      return;
    }

    setResolvingAlerts(prev => new Set(prev).add(alertId));

    try {
      await resolveInventoryAlert(alertId);
      // Reload analysis to get updated data
      await loadAnalysis();
    } catch (err: any) {
      console.error('Error resolving alert:', err);
      setError(err.response?.data?.error || 'Error al resolver la alerta');
    } finally {
      setResolvingAlerts(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const getFilteredAlerts = () => {
    if (!analysis?.alerts) return [];
    if (selectedAlertType === 'all') return analysis.alerts;
    return analysis.alerts.filter(alert => alert.alert_type === selectedAlertType);
  };

  const alertTypes = analysis?.alerts_by_type ? Object.keys(analysis.alerts_by_type) : [];
  const filteredAlerts = getFilteredAlerts();

  return (
    <AdminNavbar>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-black to-gray-700 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                    ANÁLISIS DE TENDENCIAS
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Optimización de inventario con ML
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={loadAnalysis}
              disabled={isLoading}
              className="
                px-4 py-2.5 bg-black text-white rounded-lg
                hover:bg-gray-800
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors flex items-center gap-2 text-sm font-semibold uppercase tracking-wide
              "
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              ACTUALIZAR
            </button>
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

          {isLoading ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-gray-400 animate-spin mb-4" />
              <p className="text-gray-500 text-sm">Analizando inventario...</p>
            </div>
          ) : analysis ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Health Score */}
                <div className={`border rounded-xl p-6 ${getHealthColor(analysis.health_score)}`}>
                  <div className="flex items-center justify-between mb-4">
                    {getHealthIcon(analysis.health_score)}
                    <div className="text-right">
                      <div className="text-3xl font-bold">
                        {analysis.health_score}%
                      </div>
                      <div className="text-xs uppercase tracking-wider font-medium mt-1">
                        {analysis.health_status}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    Salud del Inventario
                  </div>
                </div>

                {/* Total Products */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                      <Boxes className="w-6 h-6 text-gray-700" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {analysis.total_products}
                  </div>
                  <div className="text-sm text-gray-500">
                    Productos Analizados
                  </div>
                </div>

                {/* Total Alerts */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-orange-600" />
                    </div>
                    {analysis.alerts.length > 0 ? (
                      <ArrowUpRight className="w-5 h-5 text-orange-500" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {analysis.alerts.length}
                  </div>
                  <div className="text-sm text-gray-500">
                    Alertas Activas
                  </div>
                </div>

                {/* Alert Types */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Activity className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {alertTypes.length}
                  </div>
                  <div className="text-sm text-gray-500">
                    Tipos de Alerta
                  </div>
                </div>
              </div>

              {/* Alert Type Distribution */}
              {alertTypes.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                  <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">
                    Distribución de Alertas
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {alertTypes.map(type => (
                      <div key={type} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {type.replace('_', ' ')}
                          </span>
                          <span className="text-2xl font-bold text-gray-900">
                            {analysis.alerts_by_type[type]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysis.recommendations && analysis.recommendations.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 mb-6">
                  <h2 className="text-lg font-bold text-blue-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Recomendaciones del Sistema
                  </h2>
                  <div className="space-y-2">
                    {analysis.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm text-blue-800">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alert Filters */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">
                  Filtrar Alertas
                </h2>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setSelectedAlertType('all')}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${selectedAlertType === 'all' 
                        ? 'bg-black text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                    `}
                  >
                    Todas ({analysis.alerts.length})
                  </button>
                  {alertTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedAlertType(type)}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize
                        ${selectedAlertType === type 
                          ? 'bg-black text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      {type.replace('_', ' ')} ({analysis.alerts_by_type[type]})
                    </button>
                  ))}
                </div>
              </div>

              {/* Alerts Table */}
              {filteredAlerts.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Producto
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Tipo de Alerta
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Stock Actual
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Urgencia
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Mensaje
                          </th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredAlerts.map((alert, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {alert.product_name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`
                                inline-flex px-3 py-1 rounded-full text-xs font-medium border capitalize
                                ${getAlertTypeColor(alert.alert_type)}
                              `}>
                                {alert.alert_type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-bold text-gray-900">
                                {alert.current_stock}
                              </span>
                              {alert.recommended_stock && (
                                <div className="text-xs text-gray-500">
                                  Rec: {alert.recommended_stock}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <span className={`
                                  inline-flex px-3 py-1 rounded-full text-xs font-bold
                                  ${getUrgencyColor(alert.urgency_level)}
                                `}>
                                  {alert.urgency_level}/10
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-700">
                                {alert.message}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                {alert.resolved ? (
                                  <span className="text-xs text-green-600 font-medium">
                                    ✓ Resuelta
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => alert.id && handleResolveAlert(alert.id)}
                                    disabled={!alert.id || (alert.id ? resolvingAlerts.has(alert.id) : false)}
                                    className="
                                      px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg
                                      hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed
                                      transition-colors
                                    "
                                  >
                                    {alert.id && resolvingAlerts.has(alert.id) ? 'Resolviendo...' : 'Resolver'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No hay alertas de este tipo
                  </h3>
                  <p className="text-sm text-gray-500">
                    El inventario no tiene alertas en esta categoría.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay análisis disponible
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Actualiza para generar un análisis del inventario.
              </p>
              <button
                onClick={loadAnalysis}
                className="
                  px-6 py-3 bg-black text-white rounded-lg
                  hover:bg-gray-800
                  transition-colors font-semibold uppercase tracking-wide
                "
              >
                Analizar Inventario
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminNavbar>
  );
};

export default MLTrendsPage;
