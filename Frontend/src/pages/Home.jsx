import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import inventoryService from '../services/inventoryService.js';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/common/Header.jsx';
import BannerManager from '../components/common/BannerManager.jsx';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, canAccessPanel } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Leer banner desde runtime env (window._env_) si existe, luego fallback a import.meta.env
  const runtimeEnv = typeof window !== 'undefined' && window._env_ ? window._env_ : {};
  const [bannerUrl, setBannerUrl] = useState(runtimeEnv.VITE_BANNER_IMAGE_URL || import.meta.env.VITE_BANNER_IMAGE_URL || '');

  // Cargar banner desde el backend
  useEffect(() => {
    const loadBanner = async () => {
      try {
        const data = await inventoryService.getBanner();
        if (data.banner_url) {
          setBannerUrl(data.banner_url);
        }
      } catch (error) {
        console.log('Usando banner por defecto del .env');
      }
    };
    loadBanner();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const category = searchParams.get('category') || undefined;
        const prods = await inventoryService.getProducts({ is_active: true, category });
        setProducts(prods);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchParams]);

  const PanelButton = () => {
    if (!isAuthenticated) {
      return (
        <button className="border border-gray-900 px-3 py-1 text-sm" onClick={() => navigate('/login')}>Ingresar</button>
      );
    }
    if (!canAccessPanel()) {
      return null; // Usuario autenticado sin permisos: no mostrar panel
    }
    return (
      <button className="border border-gray-900 px-3 py-1 text-sm" onClick={() => navigate('/dashboard')}>Panel</button>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero minimalista */}
      <section className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold leading-tight">Moda boutique, online y en tienda</h1>
            <p className="mt-3 text-gray-600">Prendas seleccionadas con estilo contemporáneo. Descubre nuestra colección.</p>
            <div className="mt-6">
              <a href="#catalogo" className="border border-gray-900 px-4 py-2 text-sm">Ver catálogo</a>
            </div>
          </div>
          <div className="aspect-[4/3] bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 overflow-hidden relative">
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt="Banner Boutique"
                className="w-full h-full object-cover"
              />
            ) : (
              <span>Banner</span>
            )}
            {/* Botón de editar banner (solo para admins) */}
            <BannerManager 
              currentBannerUrl={bannerUrl} 
              onBannerUpdate={(newUrl) => setBannerUrl(newUrl)}
            />
          </div>
        </div>
      </section>

      {/* Grid de productos */}
      <section id="catalogo" className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl font-semibold">Productos</h2>
          <Link className="text-sm underline" to="/inventory">Ver todo</Link>
        </div>
        {loading ? (
          <div className="text-gray-600">Cargando...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <div
                key={p.id}
                className="group border border-gray-200 rounded-none cursor-pointer hover:shadow-sm transition-all"
                onClick={() => navigate(`/producto/${p.id}`, { state: { from: location.pathname + location.search } })}
              >
                <div className="aspect-square bg-gray-50 border-b border-gray-200 overflow-hidden">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">Sin imagen</div>
                  )}
                </div>
                <div className="p-3 flex flex-col gap-1">
                  <div className="text-sm font-medium line-clamp-2 group-hover:underline">{p.name}</div>
                  <div className="text-sm text-gray-700">Bs. {Number(p.price).toFixed(2)}</div>
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <div className="text-gray-500">No hay productos disponibles por ahora.</div>
            )}
          </div>
        )}
      </section>

      {/* Footer minimal */}
      <footer id="contacto" className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-gray-500">
          © {new Date().getFullYear()} BoutiqueCruz — Todos los derechos reservados
        </div>
      </footer>
    </div>
  );
};

export default Home;
