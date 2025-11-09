import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import inventoryService from '../../services/inventoryService.js';
import toast from 'react-hot-toast';
import CategoryEditModal from '../../components/inventory/CategoryEditModal.jsx';
import ProductEditModal from '../../components/inventory/ProductEditModal.jsx';
import logo from '../../assets/boutiquecruz1.png';
import { useAuth } from '../../context/AuthContext.jsx';

const Categories = () => {
  const navigate = useNavigate();
  const { canAccessPanel } = useAuth();
  const [initLoading, setInitLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ q: '' });

  const [selectedCat, setSelectedCat] = useState(null);
  const [catProducts, setCatProducts] = useState([]);
  const [catLoading, setCatLoading] = useState(false);

  // Modals
  const [modalCategory, setModalCategory] = useState(null); // object | null
  const [modalCategoryInfo, setModalCategoryInfo] = useState(false);
  const [modalProduct, setModalProduct] = useState(null); // product object | new seed
  const [modalProductInfo, setModalProductInfo] = useState(false);

  // Load categories
  const loadCategories = async (opts = { initial: false }) => {
    try {
      if (opts.initial) setInitLoading(true); else setListLoading(true);
      const data = await inventoryService.getCategories({ q: filters.q || undefined });
      setCategories(data);
    } catch (err) {
      const msg = err?.detail || 'Error cargando categorías';
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

  useEffect(() => { loadCategories({ initial: true }); /* eslint-disable-line */ }, []);
  useEffect(() => { loadCategories({ initial: false }); /* eslint-disable-line */ }, [filters.q]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setFilters(f => ({ ...f, q: searchInput })); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openNewCategory = () => { setModalCategory({}); setModalCategoryInfo(false); };
  const onEditCategory = (c) => { setModalCategory(c); setModalCategoryInfo(false); };
  const onInfoCategory = (c) => { setModalCategory(c); setModalCategoryInfo(true); };

  const onDeleteCategory = async (id) => {
    if (!window.confirm('¿Eliminar categoría? Esta acción no se puede deshacer.')) return;
    try {
      await inventoryService.deleteCategory(id);
      toast.success(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">Categoría eliminada</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
      // If deleted category was selected, clear selection
      if (selectedCat && Number(selectedCat.id) === Number(id)) {
        setSelectedCat(null);
        setCatProducts([]);
      }
      await loadCategories({ initial: false });
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

  const viewProducts = async (c) => {
    try {
      setSelectedCat(c);
      setCatLoading(true);
      const prods = await inventoryService.getProducts({ category: c.id });
      setCatProducts(prods);
    } catch (err) {
      const msg = 'No se pudieron cargar los productos';
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{msg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
    } finally {
      setCatLoading(false);
    }
  };

  // Product modal open helpers
  const startNewProduct = () => {
    if (!selectedCat) return;
    setModalProduct({ category: selectedCat.id, gender: selectedCat.gender || '' });
    setModalProductInfo(false);
  };
  const startEditProduct = (p) => { setModalProduct(p); setModalProductInfo(false); };
  const startInfoProduct = (p) => { setModalProduct(p); setModalProductInfo(true); };
  const deleteProduct = async (id) => {
    if (!window.confirm('¿Eliminar producto? Esta acción no se puede deshacer.')) return;
    try {
      await inventoryService.deleteProduct(id);
      toast.success('Producto eliminado');
      if (selectedCat) await viewProducts(selectedCat);
      await loadCategories({ initial: false });
    } catch (err) {
      const msg = err?.detail || 'No se pudo eliminar el producto';
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{msg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
    }
  };

  if (initLoading) {
    return (<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-600">Cargando...</div></div>);
  }

  return (
    <>
      <div className="min-h-screen bg-white overflow-x-hidden">
        <nav className="nav-slim">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>  
                            <img src={logo} alt="BoutiqueCruz" className="h-12 w-15 object-contain" />
                            <h1 className="text-xl font-semibold">Categorías</h1>
                        </div>
            <div className="space-x-2">
              {/* <button className="btn-outline-slim" onClick={() => navigate('/')}>Inicio</button> */}
              <button className="btn-outline-slim" onClick={() => navigate('/inventory')}>Productos</button>
              {canAccessPanel && canAccessPanel() && (
                <button className="btn-outline-slim" onClick={() => navigate('/dashboard')}>Panel</button>
              )}
            </div>
          </div>
        </nav>

        <div className="max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] mx-auto p-4 grid grid-cols-1 gap-3">
          <div className="card-slim p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-semibold">Listado</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar categorías..."
                  className="border rounded p-2 text-sm"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button type="button" className="btn btn-primary" onClick={openNewCategory}>Agregar categoría</button>
                {listLoading && <span className="text-xs text-gray-500">Actualizando…</span>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Género</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Productos</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categories.map(c => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{c.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {c.gender === 'U' ? (
                          <span title="Visible en Hombre y Mujer" className="inline-flex items-center gap-1">
                            <span className="px-2 py-0.5 border rounded text-xs">Unisex</span>
                            <span className="text-gray-400">•</span>
                            <span className="px-2 py-0.5 border rounded text-xs">Hombre</span>
                            <span className="text-gray-400">•</span>
                            <span className="px-2 py-0.5 border rounded text-xs">Mujer</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 border rounded text-xs">{c.gender_display || '-'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{c.kind_display || '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{c.description || '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{c.is_active ? 'Sí' : 'No'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{typeof c.product_count === 'number' ? c.product_count : '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <button className="btn-outline-slim" onClick={() => viewProducts(c)}>Ver productos</button>
                          <button className="btn-outline-slim" onClick={() => onEditCategory(c)}>Editar</button>
                          <button className="btn-outline-slim" onClick={() => onInfoCategory(c)}>Info</button>
                          <button className="btn-outline-slim" onClick={() => onDeleteCategory(c.id)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && !listLoading && (
                    <tr><td colSpan="7" className="px-3 py-3 text-center text-sm text-gray-500">Sin categorías</td></tr>
                  )}
                  {listLoading && categories.length === 0 && (
                    <tr><td colSpan="7" className="px-3 py-3 text-center text-sm text-gray-500">Cargando…</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedCat && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold">Productos en “{selectedCat.name}”</h3>
                  <div className="flex items-center gap-2">
                    <button className="btn-outline-slim" onClick={startNewProduct}>Agregar producto</button>
                    <button className="btn-outline-slim" onClick={() => navigate('/inventory')}>Ir a Productos</button>
                  </div>
                </div>
                {catLoading ? (
                  <div className="text-sm text-gray-500">Cargando productos...</div>
                ) : catProducts.length === 0 ? (
                  <div className="text-sm text-gray-500">No hay productos en esta categoría.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catProducts.map(p => (
                      <div key={p.id} className="border border-gray-200 p-3 flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-xs text-gray-400">Sin imagen</span>}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-gray-600">SKU: {p.sku} • Bs. {Number(p.price).toFixed(2)}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button className="btn-outline-slim" onClick={() => startEditProduct(p)}>Editar</button>
                          <button className="btn-outline-slim" onClick={() => startInfoProduct(p)}>Info</button>
                          <button className="btn-outline-slim" onClick={() => deleteProduct(p.id)}>Eliminar</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {modalCategory && (
        <CategoryEditModal
          category={modalCategory}
          initialInfoMode={modalCategoryInfo}
          onClose={() => { setModalCategory(null); setModalCategoryInfo(false); }}
          onSaved={async () => {
            await loadCategories({ initial: false });
            // Refresh products if editing selected category
            if (selectedCat && modalCategory.id === selectedCat.id) {
              // get updated selected category object
              const updated = categories.find(c => c.id === selectedCat.id);
              if (updated) setSelectedCat(updated);
              await viewProducts(updated || selectedCat);
            }
          }}
        />
      )}
      {modalProduct && (
        <ProductEditModal
          product={modalProduct}
          categories={categories}
          initialInfoMode={modalProductInfo}
          onClose={() => { setModalProduct(null); setModalProductInfo(false); }}
          onSaved={async () => {
            if (selectedCat) await viewProducts(selectedCat);
            await loadCategories({ initial: false });
            setModalProduct(null); setModalProductInfo(false);
          }}
        />
      )}
    </>
  );
};

export default Categories;
