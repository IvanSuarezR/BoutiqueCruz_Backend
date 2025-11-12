import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import Header from '../components/common/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import ProductEditModal from '../components/inventory/ProductEditModal.jsx';
import inventoryService from '../services/inventoryService.js';
import { useCart } from '../context/CartContext.jsx';
import toast from 'react-hot-toast';

// Util para generar slugs parecidos a Browse.jsx
const slugify = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { isAuthenticated, canAccessPanel } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const location = useLocation();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [qty, setQty] = useState(1);
  const [catInfo, setCatInfo] = useState(null);
  const [sizeStocks, setSizeStocks] = useState({});
  const [imageIndex, setImageIndex] = useState(0);

  const deriveSizeStocks = (p) => {
    const map = {};
    if (p && p.size_stocks && typeof p.size_stocks === 'object') {
      Object.entries(p.size_stocks).forEach(([k, v]) => {
        map[String(k)] = Number(v || 0) || 0;
      });
      return map;
    }
    if (p && Array.isArray(p.variants)) {
      p.variants.forEach((v) => {
        if (v && v.size != null) {
          const key = String(v.size);
          map[key] = (map[key] || 0) + (Number(v.stock || 0) || 0);
        }
      });
      if (Object.keys(map).length) return map;
    }
    (Array.isArray(p?.sizes) ? p.sizes : []).forEach((s) => { map[String(s)] = 0; });
    return map;
  };

  // Carga del producto
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const p = await inventoryService.getProduct(id);
        setProduct(p);
        const stocks = deriveSizeStocks(p || {});
        setSizeStocks(stocks);
        if (Array.isArray(p.sizes) && p.sizes.length) {
          // Seleccionar primera talla con stock > 0 si existe, si no la primera
          const firstWithStock = p.sizes.find((s) => (Number(stocks?.[s] || 0) > 0));
          setSelectedSize(firstWithStock || p.sizes[0]);
        }
        const colors = Array.isArray(p.colors) ? p.colors : (p.color ? [p.color] : []);
        if (colors.length) setSelectedColor(colors[0]);
      } catch (e) {
        toast.error('No se pudo cargar el producto');
      } finally {
        setLoading(false);
      }
    };
    load();
    // Llevar al inicio al cambiar de producto (p.ej., desde "similares")
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  // Cargar info de categoría del producto para el breadcrumb
  useEffect(() => {
    const loadCategory = async () => {
      if (!product || !product.category) {
        setCatInfo(null);
        return;
      }
      try {
        const c = await inventoryService.getCategory(product.category);
        setCatInfo(c);
      } catch {
        setCatInfo(null);
      }
    };
    loadCategory();
  }, [product?.category]);

  useEffect(() => {
    const loadCats = async () => {
      if (!(isAuthenticated && canAccessPanel())) return;
      try {
        const cats = await inventoryService.getCategories();
        setCategories(cats);
      } catch {}
    };
    loadCats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const addToCart = () => {
    if (!product) return;
    // Verificar stock disponible para la talla seleccionada
    const available = selectedSize ? Number(sizeStocks?.[selectedSize] || 0) : Infinity;
    if (selectedSize && available <= 0) {
      toast.error('Sin stock para la talla seleccionada');
      return;
    }
    if (qty > available) {
      toast.error(`Solo hay ${available} unidades disponibles para esta talla`);
      setQty(Math.max(1, available));
      return;
    }
    addItem(product, { qty, selectedSize, selectedColor });
    toast.success('Producto añadido al carrito');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="text-gray-600">Cargando...</div></div>;
  if (!product) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="text-gray-600">Producto no encontrado</div></div>;

  const colors = Array.isArray(product.colors) ? product.colors : (product.color ? [product.color] : []);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Breadcrumb pequeño */}
        <nav className="mb-6 text-xs text-gray-500">
          {(() => {
            const g = product.gender; // 'M' | 'F' | 'U' o undefined
            const gLabel = g === 'M' ? 'Hombres' : g === 'F' ? 'Mujeres' : g === 'U' ? 'Unisex' : 'Colección';
            const gSlug = g === 'M' ? 'hombre' : g === 'F' ? 'mujer' : g === 'U' ? 'unisex' : '';
            const catSlug = catInfo ? `${slugify(catInfo.name)}-${catInfo.id}` : null;
            return (
              <div className="flex flex-wrap items-center gap-1">
                {gSlug ? (
                  <Link to={`/${gSlug}`} className="hover:underline">{gLabel}</Link>
                ) : (
                  <span>{gLabel}</span>
                )}
                {catInfo && (
                  <>
                    <span className="text-gray-300">›</span>
                    <Link to={`/${gSlug}/${catSlug}`} className="hover:underline">{catInfo.name}</Link>
                  </>
                )}
                <span className="text-gray-300">›</span>
                <span className="text-gray-700">{product.name}</span>
              </div>
            );
          })()}
        </nav>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Gallery con flechas */}
          <div className="relative max-w-md mx-auto w-full">
            {(() => {
              // Normalizar imágenes: aceptar strings o objetos {url|image|src}
              let imgs = [];
              if (Array.isArray(product.images) && product.images.length) {
                imgs = product.images
                  .map((it) => {
                    if (!it) return null;
                    if (typeof it === 'string') return it;
                    return it.url || it.image || it.src || null;
                  })
                  .filter(Boolean);
              }
              if (!imgs.length && product.image) imgs = [product.image];
              const idx = Math.min(imageIndex, Math.max(0, imgs.length - 1));
              const canPrev = imgs.length > 1 && idx > 0;
              const canNext = imgs.length > 1 && idx < imgs.length - 1;
              const goPrev = () => setImageIndex((i) => Math.max(0, i - 1));
              const goNext = () => setImageIndex((i) => Math.min(imgs.length - 1, i + 1));
              return (
                <div className="group">
                  <div className="aspect-square bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center relative">
                    {imgs.length ? (
                      <img src={imgs[idx]} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400 text-sm">Sin imagen</span>
                    )}
                    {/* Arrows */}
                    {imgs.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={goPrev}
                          disabled={!canPrev}
                          className={`absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 border border-gray-300 w-8 h-8 grid place-items-center ${!canPrev ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'}`}
                          aria-label="Anterior"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={goNext}
                          disabled={!canNext}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 border border-gray-300 w-8 h-8 grid place-items-center ${!canNext ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'}`}
                          aria-label="Siguiente"
                        >
                          ›
                        </button>
                      </>
                    )}
                  </div>
                  {/* Thumbnails opcionales */}
                  {imgs.length > 1 && (
                    <div className="mt-2 flex gap-2 overflow-x-auto">
                      {imgs.map((src, i) => (
                        <button key={i} type="button" onClick={() => setImageIndex(i)} className={`border ${i===idx ? 'border-gray-900' : 'border-gray-200'} w-16 h-16 flex-shrink-0 overflow-hidden`}>
                          <img src={src} alt={`thumb-${i}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          {/* Info */}
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold leading-tight">{product.name}</h1>
                <div className="mt-2 text-xl font-medium">Bs. {Number(product.price).toFixed(2)}</div>
              </div>
              {isAuthenticated && canAccessPanel() && (
                <button
                  type="button"
                  className="btn-outline-slim text-xs flex items-center gap-1"
                  onClick={() => setEditOpen(true)}
                  title="Editar producto"
                >
                  {/* Icono engranaje */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M11.983 13.951a1.97 1.97 0 110-3.939 1.97 1.97 0 010 3.939z" /><path fillRule="evenodd" d="M4.072 14.561a8.004 8.004 0 010-5.122l2.06-.773a6.02 6.02 0 011.32-2.287L6.6 4.4a8.053 8.053 0 015.122-2.06 8.053 8.053 0 015.122 2.06l-.852 2.023a6.02 6.02 0 011.32 2.287l2.06.773a8.004 8.004 0 010 5.122l-2.06.773a6.02 6.02 0 01-1.32 2.287l.852 2.023a8.053 8.053 0 01-5.122 2.06 8.053 8.053 0 01-5.122-2.06l.852-2.023a6.02 6.02 0 01-1.32-2.287l-2.06-.773zm7.911-6.447a3.03 3.03 0 100 6.06 3.03 3.03 0 000-6.06z" clipRule="evenodd" /></svg>
                  Editar
                </button>
              )}
            </div>
            <div className="space-y-4 text-sm">
              {Array.isArray(product.sizes) && product.sizes.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 -mt-2">SKU: {product.sku}{selectedSize ? `-${selectedSize}` : ''}</div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">Tallas</div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map(s => {
                      const available = Number(sizeStocks?.[s] || 0);
                      const disabled = available <= 0;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setSelectedSize(s); setQty(q => Math.min(Math.max(1, q), Math.max(1, available))); }}
                          disabled={disabled}
                          title={disabled ? 'Sin stock' : undefined}
                          className={`px-3 py-1 border text-xs ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${selectedSize === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700'} hover:bg-gray-900 hover:text-white`}
                        >{s}</button>
                      );
                    })}
                  </div>
                  {selectedSize && (
                    <div className="text-xs text-gray-500 mt-2">Stock disponible: {Number(sizeStocks?.[selectedSize] || 0)}</div>
                  )}
                </div>
              )}
              {/* {colors.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">Colores</div>
                  <div className="flex flex-wrap gap-2">
                    {colors.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`px-3 py-1 border text-xs ${selectedColor === c ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700'} hover:bg-primary hover:text-white`}
                      >{c}</button>
                    ))}
                  </div>
                </div>
              )} */}
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">Cantidad</div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-gray-300">
                    <button className="px-2 text-sm" onClick={() => setQty(q => Math.max(1, q - 1))}>-</button>
                    <input
                      type="number"
                      value={qty}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        const max = selectedSize ? Number(sizeStocks?.[selectedSize] || 0) : Infinity;
                        setQty(() => {
                          const n = Number.isFinite(v) ? v : 1;
                          return Math.max(1, Math.min(n, max || 1));
                        });
                      }}
                      className="w-14 text-center text-sm border-l border-r border-gray-300 py-1"
                    />
                    <button
                      className="px-2 text-sm"
                      onClick={() => setQty(q => {
                        const max = selectedSize ? Number(sizeStocks?.[selectedSize] || 0) : Infinity;
                        return Math.min(q + 1, max || 1);
                      })}
                    >+</button>
                  </div>
                </div>
              </div>
              {product.description && (
                <div className="prose prose-sm max-w-none">
                  <div className="text-xs font-semibold text-gray-500 mb-1">Descripción</div>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{product.description}</p>
                </div>
              )}
            </div>
            {/* SKU por talla (visual) */}

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button onClick={addToCart} className="btn btn-primary text-sm px-3 py-2 self-start">Añadir al carrito</button>
              {/* <button className="btn-outline-slim text-sm px-3 py-2 self-start" onClick={() => navigate('/cart')}>Ver carrito</button> */}
            </div>
          </div>
        </div>
        {/* Similares: grid de 2 filas con botón Mostrar más */}
        {product && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold mb-4">Productos similares</h2>
            <SimilarProductsGrid product={product} />
          </div>
        )}
      </div>
      {editOpen && (
        <ProductEditModal
          product={product}
          categories={categories}
          initialInfoMode={false}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); navigate(0); }}
        />
      )}
    </div>
  );
};

// Grid de productos similares con botón "Mostrar más"
const SimilarProductsGrid = ({ product }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [visibleCount, setVisibleCount] = useState(8); // 2 filas de 4 inicialmente
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const list = await inventoryService.getProducts({
          is_active: true,
          category: product.category || undefined,
          gender: product.gender || undefined,
        });
        // Filtrar fuera el mismo producto y ordenar por id descendente (opcional)
        const filtered = (list || []).filter(p => p.id !== product.id);
        setItems(filtered);
      } catch (e) {
        toast.error('No se pudieron cargar similares');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [product.id, product.category, product.gender]);

  if (loading) return <div className="text-sm text-gray-500">Cargando similares...</div>;
  if (!items.length) return <div className="text-sm text-gray-500">No hay similares disponibles.</div>;

  const toShow = items.slice(0, visibleCount);
  const canShowMore = visibleCount < items.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        {toShow.map(i => (
          <div
            key={i.id}
            className="group border border-gray-200 rounded-none cursor-pointer hover:shadow-sm"
            onClick={() => navigate(`/producto/${i.id}`, { state: { from: window.location.pathname } })}
          >
            <div className="aspect-square bg-gray-50 border-b border-gray-200 overflow-hidden">
              {i.image ? (
                <img src={i.image} alt={i.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Sin imagen</div>
              )}
            </div>
            <div className="p-2">
              <div className="text-xs font-medium line-clamp-2 group-hover:underline">{i.name}</div>
              <div className="text-xs text-gray-700 mt-1">Bs. {Number(i.price).toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
      {canShowMore && (
        <div className="flex justify-center">
          <button
            type="button"
            className="btn-outline-slim text-xs"
            onClick={() => setVisibleCount(c => c + 8)}
          >Mostrar más</button>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
