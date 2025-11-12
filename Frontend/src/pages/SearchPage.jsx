import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import inventoryService from '../services/inventoryService.js';
import Header from '../components/common/Header.jsx';

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, []);

  useEffect(() => {
    // Búsqueda automática con debounce
    if (query.trim() === '') {
      setProducts([]);
      setSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 500); // 500ms de debounce

    return () => clearTimeout(timer);
  }, [query]);

  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setProducts([]);
      setSearched(false);
      return;
    }

    try {
      setLoading(true);
      setSearched(true);
      // Actualizar URL sin recargar
      setSearchParams({ q: searchQuery }, { replace: true });
      
      const results = await inventoryService.getProducts({ 
        q: searchQuery,
        is_active: true 
      });
      setProducts(results);
    } catch (error) {
      console.error('Error buscando productos:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-4">Buscar productos</h1>
          
          <div className="relative max-w-2xl">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre de producto..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              autoFocus
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setProducts([]);
                  setSearched(false);
                  setSearchParams({}, { replace: true });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Limpiar búsqueda"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-600">
            Buscando...
          </div>
        )}

        {!loading && searched && products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No se encontraron productos para "{query}"</p>
          </div>
        )}

        {!loading && products.length > 0 && (
          <>
            <div className="mb-4 text-sm text-gray-600">
              {products.length} {products.length === 1 ? 'resultado' : 'resultados'} para "{query}"
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="group border border-gray-200 rounded-none cursor-pointer hover:shadow-sm transition-all"
                  onClick={() => navigate(`/producto/${p.id}`)}
                >
                  <div className="aspect-square bg-gray-50 border-b border-gray-200 overflow-hidden">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        Sin imagen
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1">
                    <div className="text-sm font-medium line-clamp-2 group-hover:underline">
                      {p.name}
                    </div>
                    <div className="text-sm text-gray-700">
                      Bs. {Number(p.price).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !searched && (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p>Escribe para buscar productos</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
