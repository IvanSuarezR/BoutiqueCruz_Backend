import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  Users, 
  Sparkles,
  AlertCircle,
  ChevronRight,
  Loader2,
  Activity,
  DollarSign,
  ShoppingBag,
  Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getDashboardSummary, DashboardSummary } from '../../../services/mlService';
import AdminNavbar from '../../../components/admin/Navbar/AdminNavbar';

const MLDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getDashboardSummary();
      setData(response);
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setError(err.response?.data?.error || 'Error al cargar dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'alcista') return <TrendingUp className="w-5 h-5 text-green-500" />;
    if (trend === 'bajista') return <Activity className="w-5 h-5 text-red-500" />;
    return <Activity className="w-5 h-5 text-gray-500" />;
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNavbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
        </div>
      </div>
    );
  }

  return (
    <AdminNavbar>   
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8" />
            Machine Learning Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Resumen ejecutivo de predicciones, análisis e insights de ML
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Error</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Sales Forecast Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Predicción de Ventas</h2>
                      <p className="text-sm text-gray-600">Proyección de ingresos futuros</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/admin/ml/predictions')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Ver detalles
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Próximos 7 días</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${data.sales_forecast.next_7_days.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Próximos 30 días</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${data.sales_forecast.next_30_days.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Tendencia</div>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(data.sales_forecast.trend)}
                      <span className="text-lg font-semibold text-gray-900 capitalize">
                        {data.sales_forecast.trend}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Health Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <Package className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Salud del Inventario</h2>
                      <p className="text-sm text-gray-600">Análisis y alertas de stock</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/admin/ml/trends')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Ver detalles
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Total Alertas</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {data.inventory.total_alerts}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Alertas Críticas</div>
                    <div className="text-2xl font-bold text-red-600">
                      {data.inventory.critical_alerts}
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg border ${getHealthColor(data.inventory.health_score)}`}>
                    <div className="text-sm mb-1">Health Score</div>
                    <div className="text-2xl font-bold">
                      {data.inventory.health_score.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customers Segmentation Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Segmentación de Clientes</h2>
                      <p className="text-sm text-gray-600">Análisis RFM y perfiles</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/admin/ml/customer-segmentation')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Ver detalles
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Segmentos Totales</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {data.customers.total_segments}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-sm text-green-700 mb-1">Clientes VIP</div>
                    <div className="text-2xl font-bold text-green-600">
                      {data.customers.vip_customers}
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-sm text-red-700 mb-1">En Riesgo</div>
                    <div className="text-2xl font-bold text-red-600">
                      {data.customers.at_risk_customers}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Recommendations Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-pink-50 rounded-lg">
                      <Sparkles className="w-6 h-6 text-pink-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Recomendaciones de Productos</h2>
                      <p className="text-sm text-gray-600">Sistema de similitud inteligente</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/admin/ml/recommendations')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Ver detalles
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Productos con Recomendaciones</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {data.recommendations.total_products}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Similitud Promedio</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {(data.recommendations.avg_similarity * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Accesos Rápidos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => navigate('/admin/ml/predictions')}
                  className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left group"
                >
                  <Target className="w-6 h-6 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="font-semibold text-gray-900">Predicciones</div>
                  <div className="text-xs text-gray-600">Pronóstico de ventas</div>
                </button>
                
                <button
                  onClick={() => navigate('/admin/ml/recommendations')}
                  className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left group"
                >
                  <ShoppingBag className="w-6 h-6 text-pink-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="font-semibold text-gray-900">Recomendaciones</div>
                  <div className="text-xs text-gray-600">Productos similares</div>
                </button>
                
                <button
                  onClick={() => navigate('/admin/ml/trends')}
                  className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left group"
                >
                  <Package className="w-6 h-6 text-orange-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="font-semibold text-gray-900">Inventario</div>
                  <div className="text-xs text-gray-600">Análisis y alertas</div>
                </button>
                
                <button
                  onClick={() => navigate('/admin/ml/customer-segmentation')}
                  className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left group"
                >
                  <Users className="w-6 h-6 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="font-semibold text-gray-900">Segmentación</div>
                  <div className="text-xs text-gray-600">Perfiles de clientes</div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </AdminNavbar>
  );
};

export default MLDashboardPage;
