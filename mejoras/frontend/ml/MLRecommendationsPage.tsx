import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  Package, 
  Star,
  TrendingUp,
  Loader2,
  AlertCircle,
  Activity,
  ShoppingBag,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { 
  getProductRecommendations,
  trainProductRecommendationModel,
  ProductRecommendation 
} from '../../../services/mlService';
import { productService } from '../../../services/productService';
import AdminNavbar from '../../../components/admin/Navbar/AdminNavbar';
import { Product as ProductType } from '../../../services/productService';

type Product = ProductType;

const MLRecommendationsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [topN, setTopN] = useState(5);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const response = await productService.getProducts();
      const productsList = Array.isArray(response) ? response : (response.results || []);
      setProducts(productsList);
    } catch (err: any) {
      console.error('Error loading products:', err);
      setError('Error al cargar productos');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleTrainModel = async () => {
    if (!confirm('¿Estás seguro de que deseas entrenar el modelo de recomendaciones? Este proceso puede tardar varios minutos.')) {
      return;
    }

    setIsTraining(true);
    setError(null);

    try {
      const result = await trainProductRecommendationModel();
      
      if (result.success) {
        alert(`Modelo entrenado exitosamente!\n\nProductos procesados: ${result.metrics?.total_products || 'N/A'}`);
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

  const handleSelectProduct = async (product: Product) => {
    setSelectedProduct(product);
    setIsLoading(true);
    setError(null);

    try {
      const response = await getProductRecommendations(product.id, topN);
      
      if (response.success) {
        setRecommendations(response.recommendations || []);
      } else {
        setError('No se encontraron recomendaciones. Intenta entrenar el modelo primero.');
        setRecommendations([]);
      }
    } catch (err: any) {
      console.error('Error loading recommendations:', err);
      setError(err.response?.data?.error || 'Error al cargar recomendaciones. Es posible que debas entrenar el modelo primero.');
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminNavbar>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-black to-gray-700 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                    RECOMENDACIONES DE PRODUCTOS
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Sistema de recomendación basado en ML
                  </p>
                </div>
              </div>
            </div>
            
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Product Selector */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide mb-4">
                  Seleccionar Producto
                </h2>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar producto..."
                    className="
                      w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm
                      focus:outline-none focus:border-black focus:ring-1 focus:ring-black
                    "
                  />
                </div>

                {/* Top N Selector */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad de recomendaciones:
                  </label>
                  <select
                    value={topN}
                    onChange={(e) => setTopN(parseInt(e.target.value))}
                    className="
                      w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm
                      focus:outline-none focus:border-black focus:ring-1 focus:ring-black
                      bg-white
                    "
                  >
                    <option value={3}>3 productos</option>
                    <option value={5}>5 productos</option>
                    <option value={10}>10 productos</option>
                    <option value={15}>15 productos</option>
                  </select>
                </div>

                {/* Products List */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {isLoadingProducts ? (
                    <div className="py-8 text-center">
                      <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Cargando productos...</p>
                    </div>
                  ) : filteredProducts.length > 0 ? (
                    filteredProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        className={`
                          w-full p-3 rounded-lg text-left transition-all border
                          ${selectedProduct?.id === product.id 
                            ? 'bg-black text-white border-black' 
                            : 'bg-white border-gray-200 hover:border-gray-400 text-gray-900'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center
                            ${selectedProduct?.id === product.id ? 'bg-white/10' : 'bg-gray-100'}
                          `}>
                            <Package className={`w-5 h-5 ${selectedProduct?.id === product.id ? 'text-white' : 'text-gray-600'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {product.name}
                            </div>
                            <div className={`text-xs ${selectedProduct?.id === product.id ? 'text-gray-300' : 'text-gray-500'}`}>
                              ${Number(product.price).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-8 text-center">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No se encontraron productos</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recommendations Display */}
            <div className="lg:col-span-2">
              {!selectedProduct ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center h-full flex flex-col items-center justify-center">
                  <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Selecciona un Producto
                  </h3>
                  <p className="text-sm text-gray-500 max-w-md">
                    Elige un producto de la lista para ver las recomendaciones generadas por el modelo de ML.
                  </p>
                </div>
              ) : isLoading ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-gray-400 animate-spin mb-4" />
                  <p className="text-gray-500 text-sm">Generando recomendaciones...</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Selected Product Header */}
                  <div className="bg-gradient-to-r from-black to-gray-800 text-white p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-300 uppercase tracking-wider mb-1">
                          Producto Seleccionado
                        </div>
                        <div className="text-xl font-bold">
                          {selectedProduct.name}
                        </div>
                        <div className="text-sm text-gray-300 mt-1">
                          ${Number(selectedProduct.price).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="p-6">
                    {recommendations.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 mb-6">
                          <Star className="w-5 h-5 text-yellow-500" />
                          <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                            Productos Recomendados
                          </h3>
                          <span className="ml-auto text-sm text-gray-500">
                            {recommendations.length} {recommendations.length === 1 ? 'recomendación' : 'recomendaciones'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {recommendations.map((rec, index) => (
                            <div
                              key={index}
                              className="border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:-translate-y-1 transition-all"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Package className="w-6 h-6 text-gray-600" />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <h4 className="font-semibold text-gray-900 text-sm">
                                      {rec.product_name}
                                    </h4>
                                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full flex-shrink-0">
                                      <Star className="w-3 h-3 text-yellow-500" />
                                      <span className="text-xs font-medium text-yellow-700">
                                        {(rec.similarity_score * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="text-lg font-bold text-gray-900 mb-2">
                                    ${rec.price.toFixed(2)}
                                  </div>

                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <TrendingUp className="w-3 h-3" />
                                    <span>Ranking #{rec.rank}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="py-12 text-center">
                        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No hay recomendaciones disponibles
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">
                          Entrena el modelo para generar recomendaciones.
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
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminNavbar>
  );
};

export default MLRecommendationsPage;
