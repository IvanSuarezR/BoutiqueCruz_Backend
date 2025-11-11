import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import UserMenu from '../components/common/UserMenu.jsx';
import logo from '../assets/boutiquecruz1.png';
import api from '../services/axiosConfig.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MLPredictions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [predictions, setPredictions] = useState(null);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [daysAhead, setDaysAhead] = useState(30);
  const [activeModel, setActiveModel] = useState(null);
  const [trainingLogs, setTrainingLogs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardSummary();
    fetchSalesAnalytics();
  }, []);

  const fetchDashboardSummary = async () => {
    try {
  const response = await api.get('/ml/dashboard-summary/');
      if (response.data.success) {
        setActiveModel(response.data.active_model);
        setTrainingLogs(response.data.recent_trainings || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    }
  };

  const fetchSalesAnalytics = async () => {
    try {
  const response = await api.get('/ml/sales-analytics/');
      if (response.data.success) {
        setAnalytics(response.data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const handleTrainModel = async () => {
    setTrainingLoading(true);
    setError('');
    try {
  const response = await api.post('/ml/train-sales-forecast/', {
        model_type: 'random_forest'
      });
      
      if (response.data.success) {
        setActiveModel({
          id: response.data.model_id,
          name: 'Pronóstico de Ventas random_forest',
          accuracy_score: response.data.metrics.test_r2,
          metrics: response.data.metrics
        });
        fetchDashboardSummary();
        alert('✅ Modelo entrenado exitosamente!');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error entrenando modelo');
      alert('❌ Error: ' + (err.response?.data?.error || 'Error entrenando modelo'));
    } finally {
      setTrainingLoading(false);
    }
  };

  const handlePredict = async () => {
    if (!activeModel) {
      alert('⚠️ Primero debes entrenar un modelo');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/ml/predict-sales/', {
        days_ahead: daysAhead
      });
      
      if (response.data.success) {
        setPredictions(response.data.predictions);
        setSummary(response.data.summary);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error generando predicciones');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-BO', {
      style: 'currency',
      currency: 'BOB',
      minimumFractionDigits: 2
    }).format(value);
  };

  const chartData = predictions ? {
    labels: predictions.map(p => new Date(p.date).toLocaleDateString('es-BO', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Ventas Predichas (Bs.)',
        data: predictions.map(p => p.predicted_sales),
        borderColor: 'rgb(220, 38, 38)',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        fill: true,
        tension: 0.4,
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Pronóstico de Ventas',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return formatCurrency(context.parsed.y);
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return 'Bs. ' + value.toLocaleString('es-BO');
          }
        }
      }
    }
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
              <button onClick={() => navigate('/dashboard')} className="btn-outline-slim">Dashboard</button>
              <span className="text-gray-700 hidden sm:block">Bienvenido, <strong>{user?.first_name || user?.username}</strong></span>
              <UserMenu />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="card-slim p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Predicción de Ventas con Machine Learning
                </h2>
                <p className="text-gray-600">
                  Análisis predictivo basado en historial de ventas
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleTrainModel}
                  disabled={trainingLoading}
                  className="btn-outline-slim"
                >
                  {trainingLoading ? 'Entrenando...' : '🧠 Entrenar Modelo'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="card-slim p-4 mb-6 bg-red-50 border-red-200">
              <p className="text-red-600 text-sm">⚠️ {error}</p>
            </div>
          )}

          {/* Model Status */}
          {activeModel && (
            <div className="card-slim p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Estado del Modelo</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Modelo Activo</p>
                  <p className="text-gray-900 font-medium">{activeModel.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Precisión (R²)</p>
                  <p className="text-gray-900 font-medium">{(activeModel.accuracy_score * 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Entrenado</p>
                  <p className="text-gray-900 font-medium">{new Date(activeModel.trained_at).toLocaleDateString('es-BO')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Cards */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="card-slim p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Ventas Últimos 7 Días</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.sales_7d.total)}</p>
                    <p className="text-sm text-gray-600 mt-1">{analytics.sales_7d.count} órdenes</p>
                  </div>
                  <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .843-3 1.882v8.236C9 19.157 10.343 20 12 20s3-.843 3-1.882V9.882C15 8.843 13.657 8 12 8z" />
                  </svg>
                </div>
              </div>

              <div className="card-slim p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Ventas Últimos 30 Días</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.sales_30d.total)}</p>
                    <p className="text-sm text-gray-600 mt-1">{analytics.sales_30d.count} órdenes</p>
                  </div>
                  <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>

              <div className="card-slim p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Ticket Promedio (30d)</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.sales_30d.avg)}</p>
                    <p className="text-sm text-gray-600 mt-1">por orden</p>
                  </div>
                  <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Prediction Controls */}
          <div className="card-slim p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generar Predicción</h3>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Días a Predecir
                </label>
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={daysAhead}
                  onChange={(e) => setDaysAhead(parseInt(e.target.value) || 30)}
                  className="w-full border border-gray-300 rounded-none px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <button
                onClick={handlePredict}
                disabled={loading || !activeModel}
                className="btn-primary px-6"
              >
                {loading ? 'Generando...' : '📊 Predecir Ventas'}
              </button>
            </div>
          </div>

          {/* Prediction Results */}
          {predictions && summary && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="card-slim p-6 bg-gradient-to-br from-red-50 to-white">
                  <p className="text-sm text-gray-600 mb-1">Total Predicho</p>
                  <p className="text-3xl font-bold text-red-600">{formatCurrency(summary.total_predicted_sales)}</p>
                  <p className="text-sm text-gray-500 mt-1">en {summary.days_predicted} días</p>
                </div>

                <div className="card-slim p-6 bg-gradient-to-br from-blue-50 to-white">
                  <p className="text-sm text-gray-600 mb-1">Promedio Diario</p>
                  <p className="text-3xl font-bold text-blue-600">{formatCurrency(summary.avg_daily_sales)}</p>
                  <p className="text-sm text-gray-500 mt-1">por día</p>
                </div>

                <div className="card-slim p-6 bg-gradient-to-br from-green-50 to-white">
                  <p className="text-sm text-gray-600 mb-1">Crecimiento Estimado</p>
                  <p className="text-3xl font-bold text-green-600">
                    {analytics ? ((summary.avg_daily_sales / (analytics.sales_30d.total / 30) - 1) * 100).toFixed(1) : '0'}%
                  </p>
                  <p className="text-sm text-gray-500 mt-1">vs. promedio actual</p>
                </div>
              </div>

              {/* Chart */}
              <div className="card-slim p-6">
                <div style={{ height: '400px' }}>
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
            </>
          )}

          {/* Recent Training Logs */}
          {trainingLogs.length > 0 && (
            <div className="card-slim p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Entrenamientos Recientes</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registros</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duración</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">R²</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {trainingLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(log.started_at).toLocaleString('es-BO')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs rounded ${
                            log.status === 'completed' ? 'bg-green-100 text-green-800' :
                            log.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {log.status === 'completed' ? 'Completado' :
                             log.status === 'failed' ? 'Fallido' : 'Entrenando'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{log.records_processed}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{log.training_duration_seconds}s</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {log.metrics?.test_r2 ? (log.metrics.test_r2 * 100).toFixed(2) + '%' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MLPredictions;
