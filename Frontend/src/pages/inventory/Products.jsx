import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import inventoryService from '../../services/inventoryService.js';
import toast from 'react-hot-toast';
import ProductEditModal from '../../components/inventory/ProductEditModal.jsx';
import logo from '../../assets/boutiquecruz1.png';
import { useAuth } from '../../context/AuthContext.jsx';

const Products = () => {
  const navigate = useNavigate();
  const { canAccessPanel } = useAuth();

  // Loading states
  const [initLoading, setInitLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  // Data
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  // Modal state for create/edit sidebar
  const [modalProduct, setModalProduct] = useState(null);
  const [modalInitialInfo, setModalInitialInfo] = useState(false);

  // Filters UI state
  const [filters, setFilters] = useState({ q: '', category: '', gender: '', sort: '', is_active: '', stock_level: '', colors: [] });
  // Extensiones de filtros avanzados
  // created_from/created_to (YYYY-MM-DD), stock_min/stock_max numéricos
  const [searchInput, setSearchInput] = useState('');
  const [colorFilterInput, setColorFilterInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');

  const load = async (opts = { initial: false }) => {
    try {
      if (opts.initial) setInitLoading(true); else setListLoading(true);
      const [prods, cats] = await Promise.all([
        inventoryService.getProducts({
          q: filters.q || undefined,
          category: filters.category || undefined,
          gender: filters.gender || undefined,
          sort: filters.sort || undefined,
          is_active: filters.is_active || undefined,
          stock_level: filters.stock_level || undefined,
          colors: (filters.colors && filters.colors.length) ? filters.colors.join(',') : undefined,
          created_from: filters.created_from || undefined,
          created_to: filters.created_to || undefined,
          stock_min: filters.stock_min !== undefined && filters.stock_min !== '' ? filters.stock_min : undefined,
          stock_max: filters.stock_max !== undefined && filters.stock_max !== '' ? filters.stock_max : undefined,
        }),
        inventoryService.getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      const msg = err?.detail || 'Error cargando inventario';
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{msg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
    } finally {
      if (opts.initial) setInitLoading(false); else setListLoading(false);
    }
  };

  useEffect(() => {
    load({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el input visible con la categoría seleccionada
  useEffect(() => {
    if (!filters.category) { setCategoryInput(''); return; }
    const c = categories.find((x) => String(x.id) === String(filters.category));
    setCategoryInput(c ? c.name : '');
  }, [filters.category, categories]);

  useEffect(() => {
    load({ initial: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.category, filters.gender, filters.sort, filters.is_active, filters.stock_level, filters.colors, filters.created_from, filters.created_to, filters.stock_min, filters.stock_max]);

  // Debounce search typing
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, q: searchInput }));
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  

  const onEdit = (p) => {
    // Abrir editor mejorado en modal para "retoques" finales
    setModalProduct(p);
    setModalInitialInfo(false);
  };

  const onInfo = (p) => {
    setModalProduct(p);
    setModalInitialInfo(true);
  };

  const onDelete = async (id) => {
    if (!window.confirm('¿Eliminar producto? Esta acción no se puede deshacer.')) return;
    try {
      await inventoryService.deleteProduct(id);
      toast.success(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">Producto eliminado</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
      await load();
    } catch (err) {
      const msg = err?.detail || 'No se pudo eliminar';
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{msg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
    }
  };

  if (initLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-white overflow-x-hidden">
      <nav className="nav-slim">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>  
                <img src={logo} alt="BoutiqueCruz" className="h-12 w-15 object-contain" />
                <h1 className="text-xl font-semibold">Productos</h1>
            </div>
          </div>
          <div className="space-x-2">
            {/* <button className="btn-outline-slim" onClick={() => navigate('/')}>Inicio</button> */}
            <button className="btn-outline-slim" onClick={() => navigate('/inventory/categories')}>Categorías</button>
            {canAccessPanel && canAccessPanel() && (
              <button className="btn-outline-slim" onClick={() => navigate('/dashboard')}>Panel</button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] mx-auto p-4 grid grid-cols-1 md:grid-cols-1 gap-3">
        {/* Tabla */}
        <div className="card-slim p-4 md:col-span-1">
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Listado</h2>
              <button type="button" className="btn btn-primary" onClick={()=> setModalProduct({})}>Agregar producto</button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Buscar..."
                className="border rounded p-2 text-sm"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <input
                  list="category-list"
                  className="border rounded p-2 text-sm min-w-[200px]"
                  placeholder="Buscar categoría..."
                  value={categoryInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategoryInput(val);
                    const match = categories.find((c) => c.name.toLowerCase() === val.toLowerCase());
                    setFilters((f) => ({ ...f, category: match ? String(match.id) : '' }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = categoryInput.trim().toLowerCase();
                      if (!val) { setFilters((f)=>({...f, category: ''})); return; }
                      const exact = categories.find((c) => c.name.toLowerCase() === val);
                      if (exact) { setFilters((f)=>({...f, category: String(exact.id)})); return; }
                      const partial = categories.filter((c) => c.name.toLowerCase().includes(val));
                      if (partial.length === 1) {
                        setCategoryInput(partial[0].name);
                        setFilters((f)=>({...f, category: String(partial[0].id)}));
                      }
                    }
                  }}
                />
                <datalist id="category-list">
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                <button
                  type="button"
                  className="btn-outline-slim text-xs"
                  onClick={() => { setFilters((f)=>({...f, category: ''})); setCategoryInput(''); }}
                >
                  Todas
                </button>
              </div>
              {/* Indicador de carga */}
              {listLoading && (
                <span className="text-xs text-gray-500">Actualizando…</span>
              )}
            </div>
          </div>

          {/* Más filtros (dropdown/collapsible) */}
          <details className="mt-2 mb-3">
            <summary className="cursor-pointer select-none text-sm text-gray-600 hover:text-gray-800">Más filtros</summary>
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm text-gray-500">Género:</span>
                {[{k:'',label:'Todos'},{k:'M',label:'Hombre'},{k:'F',label:'Mujer'},{k:'U',label:'Unisex'}].map(opt=> (
                  <button key={opt.k} type="button" onClick={()=> setFilters(f=> ({...f, gender: opt.k}))} className={`px-2 py-1 border rounded text-sm ${filters.gender===opt.k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Controles modernos (segmentados y chips) en dropdown */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm text-gray-500">Orden:</span>
                {[
                  {k:'', label:'Nombre'},
                  {k:'recent', label:'Recientes'},
                  {k:'price_asc', label:'Precio ↑'},
                  {k:'price_desc', label:'Precio ↓'},
                  {k:'stock_desc', label:'Stock ↑'},
                  {k:'stock_asc', label:'Stock ↓'},
                ].map(opt => (
                  <button key={opt.k} type="button" onClick={() => setFilters(f=>({...f, sort: opt.k}))} className={`px-2 py-1 border rounded text-sm ${filters.sort===opt.k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm text-gray-500">Visibilidad:</span>
                {[
                  {k:'', label:'Todos'},
                  {k:'true', label:'Activos'},
                  {k:'false', label:'Ocultos'},
                ].map(opt => (
                  <button key={opt.k} type="button" onClick={() => setFilters(f=>({...f, is_active: opt.k}))} className={`px-2 py-1 border rounded text-sm ${filters.is_active===opt.k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm text-gray-500">Stock (nivel):</span>
                {[
                  {k:'', label:'Todos'},
                  {k:'out', label:'Sin'},
                  {k:'low', label:'Bajo'},
                  // {k:'ok', label:'OK'},
                  {k:'high', label:'Alto'},
                ].map(opt => (
                  <button key={opt.k} type="button" onClick={() => setFilters(f=>({...f, stock_level: opt.k}))} className={`px-2 py-1 border rounded text-sm ${filters.stock_level===opt.k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700'}`}>
                    {opt.label}
                  </button>
                ))}
              </div> */}
              {/* Fecha agregado (rango) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 whitespace-nowrap">Fecha desde:</label>
                  <input type="date" className="border rounded p-2 text-sm w-full" value={filters.created_from || ''} onChange={(e)=> setFilters(f=>({...f, created_from: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 whitespace-nowrap">Hasta:</label>
                  <input type="date" className="border rounded p-2 text-sm w-full" value={filters.created_to || ''} onChange={(e)=> setFilters(f=>({...f, created_to: e.target.value }))} />
                </div>
              </div>

              {/* Chips de categoría */}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500 mt-1">Categoría:</span>
                <button type="button" onClick={()=>setFilters(f=>({...f, category: ''}))} className={`px-2 py-1 border rounded text-sm ${!filters.category ? 'bg-gray-900 text-white border-gray-900' : ''}`}>Todas</button>
                {categories.map(c => (
                  <button key={c.id} type="button" onClick={()=>setFilters(f=>({...f, category: String(c.id)}))} className={`px-2 py-1 border rounded text-sm ${String(filters.category)===String(c.id) ? 'bg-gray-900 text-white border-gray-900' : ''}`}>{c.name}</button>
                ))}
              </div>

              {/* Filtro por colores (chips + input) */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">Colores:</span>
                {filters.colors.map((c,i) => (
                  <span key={`${c}-${i}`} className="px-2 py-1 bg-gray-100 border rounded text-sm flex items-center gap-1">
                    {c}
                    <button type="button" className="text-gray-500 hover:text-gray-700" onClick={()=> setFilters(f=>({...f, colors: f.colors.filter((x,idx)=> idx!==i)}))}>×</button>
                  </span>
                ))}
                <input
                  type="text"
                  value={colorFilterInput}
                  onChange={(e)=> setColorFilterInput(e.target.value)}
                  onKeyDown={(e)=>{
                    if (e.key==='Enter') {
                      e.preventDefault();
                      const v = colorFilterInput.trim();
                      if (v && !filters.colors.includes(v)) setFilters(f=>({...f, colors: [...f.colors, v]}));
                      setColorFilterInput('');
                    }
                  }}
                  placeholder="Agregar color y Enter"
                  className="border rounded p-2 text-sm"
                />
                {filters.colors.length>0 && (
                  <button type="button" className="btn-outline-slim text-xs" onClick={()=> setFilters(f=>({...f, colors: []}))}>Limpiar</button>
                )}
              </div>

              {/* Stock avanzado (rango) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 whitespace-nowrap">Stock mín.:</label>
                  <input type="number" className="border rounded p-2 text-sm w-full" value={filters.stock_min ?? ''} onChange={(e)=> setFilters(f=>({...f, stock_min: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 whitespace-nowrap">Stock máx.:</label>
                  <input type="number" className="border rounded p-2 text-sm w-full" value={filters.stock_max ?? ''} onChange={(e)=> setFilters(f=>({...f, stock_max: e.target.value }))} />
                </div>
              </div>
            </div>
          </details>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Género</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Colores</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tallas</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagen</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visible</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {listLoading && products.length === 0 && (
                  <tr>
                    <td className="px-3 py-3 text-center text-sm text-gray-500" colSpan="10">Cargando…</td>
                  </tr>
                )}
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="px-2 py-2 text-sm text-gray-900 whitespace-nowrap">{p.sku}</td>
                    <td className="px-2 py-2 text-sm text-gray-900">{p.name}</td>
                    <td className="px-2 py-2 text-sm text-gray-900 whitespace-nowrap">{p.gender_display || '-'}</td>
                    <td className="px-2 py-2 text-sm text-gray-900">{p.category_name || '-'}</td>
                    <td className="px-2 py-2 text-sm text-gray-900">{Array.isArray(p.colors) && p.colors.length ? p.colors.join(', ') : (p.color || '-')}</td>
                    <td className="px-2 py-2 text-sm text-gray-900">{Array.isArray(p.sizes) && p.sizes.length ? p.sizes.join(', ') : '-'}</td>
                    <td className="px-2 py-2 text-sm text-gray-900">{p.image ? (<img src={p.image} alt={p.name} className="h-10 w-10 object-cover rounded" />) : '-'}</td>
                    <td className="px-2 py-2 text-sm text-gray-900 whitespace-nowrap">{Number(p.price).toFixed(2)}</td>
                    <td className="px-2 py-2 text-sm text-gray-900 whitespace-nowrap">{p.stock}</td>
                    <td className="px-2 py-2 text-sm text-gray-900 whitespace-nowrap">{p.is_active ? 'Sí' : 'No'}</td>
                    <td className="px-2 py-2 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <button className="btn-outline-slim" onClick={() => onEdit(p)}>Editar</button>
                        <button className="btn-outline-slim" onClick={() => onInfo(p)}>Info</button>
                        <button className="btn-outline-slim" onClick={() => onDelete(p.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && !listLoading && (
                  <tr>
                    <td className="px-3 py-3 text-center text-sm text-gray-500" colSpan="10">Sin productos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    {modalProduct && (
      <ProductEditModal
        product={modalProduct}
        categories={categories}
        initialInfoMode={modalInitialInfo}
        onClose={() => { setModalProduct(null); setModalInitialInfo(false); }}
        onSaved={async () => { await load(); setModalProduct(null); setModalInitialInfo(false);} }
      />
    )}
    </>
  );
};

export default Products;
