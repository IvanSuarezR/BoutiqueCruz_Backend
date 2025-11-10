import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Loader2,
  AlertCircle,
  RefreshCw,
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
  AlertTriangle,
  UserX,
  Star,
  X
} from 'lucide-react';
import { 
  trainCustomerSegmentationModelAdvanced,
  getCustomerSegment,
  CustomerSegment 
} from '../../../services/mlService';
import AdminNavbar from '../../../components/admin/Navbar/AdminNavbar';

const MLCustomerSegmentationPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchCustomerId, setSearchCustomerId] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegment | null>(null);
  const [nClusters, setNClusters] = useState(6);

  const handleTrainModel = async () => {
    if (!confirm(`¿Estás seguro de que deseas entrenar el modelo con ${nClusters} segmentos? Este proceso puede tardar varios minutos.`)) {
      return;
    }

    setIsTraining(true);
    setError(null);

    try {
      const result = await trainCustomerSegmentationModelAdvanced(nClusters);
      
      if (result.success) {
        alert(`Modelo entrenado exitosamente!\n\nClientes procesados: ${result.metrics?.n_customers || 'N/A'}\nSegmentos creados: ${nClusters}`);
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

  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchCustomerId.trim()) {
      setError('Por favor ingresa un ID de cliente');
      return;
    }

    setIsSearching(true);
    setError(null);
    setSelectedSegment(null);

    try {
      const result = await getCustomerSegment(searchCustomerId.trim());
      
      if (result) {
        setSelectedSegment(result);
      } else {
        setError('No se encontró información del cliente. Intenta entrenar el modelo primero.');
      }
    } catch (err: any) {
      console.error('Error searching customer:', err);
      setError(err.response?.data?.error || 'Error al buscar cliente. Es posible que debas entrenar el modelo primero o que el ID no exista.');
    } finally {
      setIsSearching(false);
    }
  };

  const getSegmentIcon = (segmentType: string) => {
    switch (segmentType.toLowerCase()) {
      case 'vip':
      case 'champions':
        return <Award className="w-6 h-6 text-yellow-500" />;
      case 'loyal':
      case 'loyal customers':
        return <Star className="w-6 h-6 text-blue-500" />;
      case 'promising':
      case 'potential loyalist':
        return <TrendingUp className="w-6 h-6 text-green-500" />;
      case 'at risk':
      case 'need attention':
        return <AlertTriangle className="w-6 h-6 text-orange-500" />;
      case 'hibernating':
      case 'lost':
        return <UserX className="w-6 h-6 text-red-500" />;
      default:
        return <Users className="w-6 h-6 text-gray-500" />;
    }
  };

  const getSegmentColor = (segmentType: string) => {
    switch (segmentType.toLowerCase()) {
      case 'vip':
      case 'champions':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'loyal':
      case 'loyal customers':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'promising':
      case 'potential loyalist':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'at risk':
      case 'need attention':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'hibernating':
      case 'lost':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getRFMScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600 bg-green-50';
    if (score >= 3) return 'text-blue-600 bg-blue-50';
    if (score >= 2) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  return (

    <AdminNavbar>
    <div className="min-h-screen bg-gray-50">
      
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-8 h-8" />
            Segmentación de Clientes
          </h1>
          <p className="text-gray-600 mt-2">
            Análisis RFM (Recency, Frequency, Monetary) y perfiles de comportamiento
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">Error</h3>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Search & Train */}
          <div className="lg:col-span-1 space-y-6">
            {/* Train Model Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Entrenar Modelo
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número de Segmentos
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="10"
                    value={nClusters}
                    onChange={(e) => setNClusters(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    disabled={isTraining}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Recomendado: 6 segmentos (3-10 disponible)
                  </p>
                </div>

                <button
                  onClick={handleTrainModel}
                  disabled={isTraining}
                  className="w-full px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {isTraining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Entrenando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Entrenar Modelo
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Search Customer Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Buscar Cliente
              </h2>
              
              <form onSubmit={handleSearchCustomer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID del Cliente (UUID)
                  </label>
                  <input
                    type="text"
                    value={searchCustomerId}
                    onChange={(e) => setSearchCustomerId(e.target.value)}
                    placeholder="ej: 123e4567-e89b-12d3-a456-426614174000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    disabled={isSearching}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSearching || !searchCustomerId.trim()}
                  className="w-full px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Buscar Segmento
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Análisis RFM
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><strong>Recency:</strong> Última compra</li>
                <li><strong>Frequency:</strong> Cantidad de compras</li>
                <li><strong>Monetary:</strong> Valor total gastado</li>
              </ul>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2">
            {selectedSegment ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Perfil del Cliente
                </h2>

                {/* Segment Badge */}
                <div className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg border mb-6 ${getSegmentColor(selectedSegment.segment_type)}`}>
                  {getSegmentIcon(selectedSegment.segment_type)}
                  <span className="font-bold text-lg">
                    {selectedSegment.segment_type}
                  </span>
                </div>

                {/* RFM Scores */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Puntuaciones RFM</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className={`p-4 rounded-lg ${getRFMScoreColor(selectedSegment.rfm_scores.recency)}`}>
                      <div className="text-sm font-medium mb-1">Recency</div>
                      <div className="text-2xl font-bold">
                        {selectedSegment.rfm_scores.recency}
                      </div>
                    </div>
                    <div className={`p-4 rounded-lg ${getRFMScoreColor(selectedSegment.rfm_scores.frequency)}`}>
                      <div className="text-sm font-medium mb-1">Frequency</div>
                      <div className="text-2xl font-bold">
                        {selectedSegment.rfm_scores.frequency}
                      </div>
                    </div>
                    <div className={`p-4 rounded-lg ${getRFMScoreColor(selectedSegment.rfm_scores.monetary)}`}>
                      <div className="text-sm font-medium mb-1">Monetary</div>
                      <div className="text-2xl font-bold">
                        {selectedSegment.rfm_scores.monetary}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Characteristics */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Características</h3>
                  <div className="space-y-2">
                    {selectedSegment.characteristics.map((char, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 bg-black rounded-full mt-1.5 flex-shrink-0"></div>
                        <span className="text-gray-700">{char}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Recomendaciones de Marketing</h3>
                  <div className="space-y-2">
                    {selectedSegment.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No hay cliente seleccionado
                </h3>
                <p className="text-gray-600 mb-6">
                  Busca un cliente por su ID para ver su perfil y segmento
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-700">
                  <Activity className="w-4 h-4" />
                  Usa el buscador de la izquierda
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Segment Types Legend */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Tipos de Segmentos Comunes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'Champions / VIP', desc: 'Compran frecuentemente y recientemente, alto valor', icon: Award, color: 'yellow' },
              { name: 'Loyal Customers', desc: 'Compran regularmente, valor medio-alto', icon: Star, color: 'blue' },
              { name: 'Promising', desc: 'Nuevos clientes con potencial', icon: TrendingUp, color: 'green' },
              { name: 'At Risk', desc: 'Antes compraban, ahora no tanto', icon: AlertTriangle, color: 'orange' },
              { name: 'Hibernating', desc: 'No compran hace tiempo', icon: Activity, color: 'gray' },
              { name: 'Lost', desc: 'Inactivos por largo período', icon: UserX, color: 'red' },
            ].map((segment, index) => {
              const Icon = segment.icon;
              return (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-5 h-5 text-${segment.color}-600`} />
                    <span className="font-semibold text-gray-900">{segment.name}</span>
                  </div>
                  <p className="text-sm text-gray-600">{segment.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </AdminNavbar>
  );
};

export default MLCustomerSegmentationPage;
