import { useEffect, useMemo, useRef, useState } from 'react';
import inventoryService from '../../services/inventoryService.js';
import toast from 'react-hot-toast';
import GCSGalleryModal from './GCSGalleryModal.jsx';

const computeTotal = (map) => Object.values(map || {}).reduce((a, b) => a + (Number(b || 0) || 0), 0);

// Mini componente para las miniaturas con reordenamiento/ eliminación / principal
const ImageThumbnails = ({ existingImages, files, libraryItems, primaryIndex, setPrimaryIndex, setExistingImages, setFiles, setLibraryItems, setRemovedImages, setRemovedImageIds, addLibraryItemToOrder, fileInputRef, openLibrary, openGCSGallery }) => {
  // dragIndex manejado dentro de ImageThumbnails
  const [dragIndex, setDragIndex] = useState(null);
  const combined = [
    ...existingImages.map((it) => (typeof it === 'string'
      ? { type: 'existing', id: undefined, src: it }
      : { type: 'existing', id: it?.id, src: it?.url || it?.image || it?.src })),
    ...files.map((f) => ({ type: 'new', file: f })),
    ...libraryItems.map((it) => ({ type: 'library', source_id: it.id, src: it.url })),
  ].filter((x) => (x.type === 'new' ? !!x.file : !!x.src));

  const onRemove = (idx) => {
    const item = combined[idx];
    if (!item) return;
    if (item.type === 'existing') {
      setExistingImages((prev) => prev.filter((srcOrObj) => {
        const url = typeof srcOrObj === 'string' ? srcOrObj : (srcOrObj?.url || srcOrObj?.image || srcOrObj?.src);
        return url !== item.src;
      }));
    } else if (item.type === 'new') {
      setFiles((prev) => prev.filter((f) => f !== item.file));
    } else if (item.type === 'library') {
      setLibraryItems((prev) => prev.filter((x) => x.id !== item.source_id));
    }
    if (item.type === 'existing') {
      if (setRemovedImages && item.src) {
        setRemovedImages((prev) => (prev.includes(item.src) ? prev : [...prev, item.src]));
      }
      if (setRemovedImageIds && item.id) {
        setRemovedImageIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      }
    }
    setPrimaryIndex((pi) => {
      if (pi === idx) return 0;
      if (pi > idx) return pi - 1;
      return pi;
    });
  };

  const onDropBetween = (from, to) => {
    const arr = [...combined];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const newExisting = [];
    const newFiles = [];
    const newLibrary = [];
    arr.forEach((item) => {
      if (item.type === 'existing') newExisting.push({ id: item.id, url: item.src });
      else if (item.type === 'new') newFiles.push(item.file);
      else if (item.type === 'library') newLibrary.push({ id: item.source_id, url: item.src });
    });
    setExistingImages(newExisting);
    setFiles(newFiles);
    setLibraryItems(newLibrary);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {combined.map((item, idx) => {
        const isPrimary = primaryIndex === idx;
        const src = item.type === 'new' ? URL.createObjectURL(item.file) : item.src;
        return (
          <div
            key={`thumb-${idx}`}
            draggable
            onDragStart={(e) => {
              setDragIndex(idx);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDragEnter={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragIndex === null || dragIndex === idx) {
                setDragIndex(null);
                return;
              }
              onDropBetween(dragIndex, idx);
              if (primaryIndex === dragIndex) {
                setPrimaryIndex(idx);
              } else if (primaryIndex === idx && dragIndex < idx) {
                setPrimaryIndex(primaryIndex - 1);
              } else if (primaryIndex > dragIndex && primaryIndex <= idx) {
                setPrimaryIndex(primaryIndex - 1);
              } else if (primaryIndex < dragIndex && primaryIndex >= idx) {
                setPrimaryIndex(primaryIndex + 1);
              }
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`relative border ${isPrimary ? 'border-blue-500 border-2' : 'border-gray-300'} ${dragIndex === idx ? 'opacity-50' : ''} w-16 h-16 overflow-hidden cursor-move transition-opacity`}
            title="Arrastra para reordenar. Click en P para principal"
          >
            <button 
              type="button" 
              className={`absolute top-1 left-1 ${isPrimary ? 'bg-blue-500 text-white' : 'bg-white/90'} text-[10px] px-1.5 rounded shadow-sm border ${isPrimary ? 'border-blue-600' : 'border-gray-300'}`} 
              onClick={() => setPrimaryIndex(idx)}
              title="Marcar como principal"
            >
              P
            </button>
            <button
              type="button"
              className="absolute top-1 right-1 bg-red-500 text-white text-[10px] px-1.5 rounded shadow-sm hover:bg-red-600"
              onClick={() => onRemove(idx)}
              title="Eliminar"
            >
              ×
            </button>
            <img src={src} alt={`thumb-${idx}`} className="w-full h-full object-cover pointer-events-none" />
          </div>
        );
      })}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 w-16 h-16 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
          title="Subir nuevas imágenes"
        >
          +
        </button>
        <button
          type="button"
          onClick={openGCSGallery}
          className="border border-gray-300 w-16 h-16 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          title="Gestor de galería GCS"
        >
          Seleccionar
        </button>
        {/* <button
          type="button"
          onClick={openLibrary}
          className="border border-gray-300 w-16 h-16 flex items-center justify-center text-[10px] text-gray-600 hover:bg-gray-50"
          title="Librería de productos"
        >
          Lib
        </button> */}
      </div>
      {existingImages.length === 0 && files.length === 0 && (
        <div className="text-xs text-gray-500">Sin imágenes aún</div>
      )}
    </div>
  );
};

const ProductEditModal = ({ product, categories, onClose, onSaved, initialInfoMode = false }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sku: product?.sku || '',
    name: product?.name || '',
    gender: product?.gender || '',
    price: product?.price || 0,
    description: product?.description || '',
    is_active: typeof product?.is_active === 'boolean' ? product.is_active : true,
    category: product?.category || '',
  });
  const [colors, setColors] = useState(Array.isArray(product?.colors) ? product.colors : (product?.color ? [product.color] : []));
  const [sizes, setSizes] = useState(Array.isArray(product?.sizes) ? product.sizes : []);
  const [sizeStocks, setSizeStocks] = useState({});
  const [newSizeInput, setNewSizeInput] = useState('');
  // Galería: imágenes existentes (urls del servidor) y nuevas (File)
  // Evitar duplicado visual: si hay lista product.images la usamos y NO añadimos product.image (legacy principal) para no mostrarla dos veces
  const [existingImages, setExistingImages] = useState(
    Array.isArray(product?.images) && product.images.length
      ? product.images
      : (product?.image ? [product.image] : [])
  );
  const [removedImages, setRemovedImages] = useState([]); // URLs marcadas para remover (compat)
  const [removedImageIds, setRemovedImageIds] = useState([]); // IDs marcados para remover (preferido)
  const [files, setFiles] = useState([]); // nuevas imágenes
  const [libraryItems, setLibraryItems] = useState([]); // imágenes seleccionadas desde la librería (reutilizadas)
  const [showLibrary, setShowLibrary] = useState(false);
  const [showGCSGallery, setShowGCSGallery] = useState(false); // Gestor de galería GCS
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryData, setLibraryData] = useState([]);
  const [primaryIndex, setPrimaryIndex] = useState(0); // índice dentro de la lista combinada visible
  const [dragIndex, setDragIndex] = useState(null);
  const [infoMode, setInfoMode] = useState(Boolean(initialInfoMode));
  const detailLoadedRef = useRef(false);
  const fileInputRef = useRef(null);
  const [forceDeleteRemoved, setForceDeleteRemoved] = useState(false); // Si al quitar existentes también se borra el archivo
  const [salesBySize, setSalesBySize] = useState({}); // Ventas por talla

  const selectedCategory = useMemo(() => (categories || []).find((c) => String(c.id) === String(form.category)), [categories, form.category]);
  const isNew = !product || !product.id;
  const totalStock = useMemo(() => computeTotal(sizeStocks), [sizeStocks]);

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
  
  // Inicializar sizeStocks (y tallas si faltan) desde el producto
  useEffect(() => {
    const map = deriveSizeStocks(product || {});
    setSizeStocks(map);
    if ((!sizes || sizes.length === 0) && map && Object.keys(map).length) {
      setSizes(Object.keys(map));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  // Cargar ventas por talla cuando está en modo info y el producto existe
  useEffect(() => {
    if (infoMode && product && product.id) {
      inventoryService.getSalesBySize(product.id)
        .then(data => {
          setSalesBySize(data.sales_by_size || {});
        })
        .catch(err => {
          console.error('Error cargando ventas:', err);
          setSalesBySize({});
        });
    }
  }, [infoMode, product]);

  // Bloques JSX huérfanos eliminados (eran la causa del error de compilación)
  const addSize = (sz) => {
    const v = String(sz || '').trim();
    if (!v) return;
    if (!sizes.includes(v)) setSizes((prev) => [...prev, v]);
    setSizeStocks((m) => ({ ...m, [v]: m[v] ?? 0 }));
  };

  const removeSize = (sz) => {
    setSizes((prev) => prev.filter((x) => x !== sz));
    setSizeStocks((m) => {
      const n = { ...m };
      delete n[sz];
      return n;
    });
  };

  const loadLibrary = async () => {
    try {
      setLibraryLoading(true);
      const data = await inventoryService.getImagesLibrary({ limit: 300 });
      setLibraryData(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('No se pudo cargar librería de imágenes');
    } finally {
      setLibraryLoading(false);
    }
  };

  const addLibraryItemToOrder = (item) => {
    if (!item || !item.id) return;
    // evitar duplicados (no agregar dos veces la misma source_id)
    if (libraryItems.find((x) => x.id === item.id)) return;
    setLibraryItems((prev) => [...prev, item]);
  };

  // Manejar selección de imágenes desde GCS Gallery
  const handleGCSImageSelect = (gcsImages) => {
    // gcsImages es un array de objetos { name, url, size, content_type }
    // Usar el endpoint del backend para descargar las imágenes (evita CORS)
    const fetchAndConvertToFile = async (gcsImg) => {
      try {
        // Usar el proxy del backend para descargar la imagen
        const response = await inventoryService.downloadGCSImage(gcsImg.url);
        
        // response ya es un Blob
        const filename = gcsImg.name.split('/').pop();
        return new File([response], filename, { type: gcsImg.content_type || 'image/jpeg' });
      } catch (error) {
        console.error('Error al cargar imagen de GCS:', error);
        toast.error(`No se pudo cargar ${gcsImg.name}`);
        return null;
      }
    };

    // Cargar todas las imágenes seleccionadas
    Promise.all(gcsImages.map(fetchAndConvertToFile))
      .then(newFiles => {
        const validFiles = newFiles.filter(f => f !== null);
        if (validFiles.length > 0) {
          setFiles(prev => [...prev, ...validFiles]);
          toast.success(`${validFiles.length} imagen(es) agregada(s) desde GCS`);
        }
        setShowGCSGallery(false);
      });
  };

  const onSave = async () => {
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append('sku', form.sku);
      fd.append('name', form.name);
      if (form.gender) fd.append('gender', form.gender);
      if (form.category) fd.append('category', form.category);
      fd.append('price', String(Number(form.price) || 0));
      // Persist legacy total stock as sum of per-size stocks (backend change pending for true per-size inventory)
      fd.append('stock', String(totalStock));
      if (form.description) fd.append('description', form.description);
      if (colors.length) fd.append('colors', JSON.stringify(colors));
      if (sizes.length) fd.append('sizes', JSON.stringify(sizes));
      if (sizeStocks && Object.keys(sizeStocks).length) fd.append('size_stocks', JSON.stringify(sizeStocks));
      fd.append('is_active', form.is_active ? 'true' : 'false');
  if (removedImages.length) fd.append('removed_images', JSON.stringify(removedImages));

      // Determinar orden final de imágenes (existentes + nuevas)
      const combined = [
        ...existingImages.map((it) => (typeof it === 'string'
          ? { type: 'existing', id: undefined, src: it }
          : { type: 'existing', id: it.id, src: it.url || it.image || it.src })),
        ...files.map((f) => ({ type: 'new', file: f })),
        ...libraryItems.map((it) => ({ type: 'library', source_id: it.id, src: it.url })),
      ].filter((x) => (x.type === 'new' ? !!x.file : !!x.src));

      // Imagen principal: índice primaryIndex en la lista combinada
      const primaryItem = combined[Math.min(primaryIndex, Math.max(0, combined.length - 1))];
      // Reordenar colocando la primaria primero para que el backend la tome por fallback
      const combinedOrdered = primaryItem
        ? [primaryItem, ...combined.filter((_, i) => i !== Math.min(primaryIndex, Math.max(0, combined.length - 1)))]
        : combined;
      if (primaryItem) {
        if (primaryItem.type === 'existing' && primaryItem.src) {
          fd.append('primary_image_url', primaryItem.src);
        } else if (primaryItem.type === 'library' && primaryItem.source_id) {
          fd.append('primary_library_source_id', String(primaryItem.source_id));
        }
      }

      // Nuevas imágenes en orden
      files.forEach((f) => fd.append('images', f));
      // Enviar orden completo (ids o urls + placeholder para nuevas) para que el backend pueda reordenar existentes
      const ordered_payload = combinedOrdered.map((it) => {
        if (it.type === 'new') return { type: 'new', name: it.file?.name };
        if (it.type === 'existing') return it.id ? { type: 'existing', id: it.id } : { type: 'existing', url: it.src };
        if (it.type === 'library') return { type: 'library', source_id: it.source_id };
        return { type: it.type };
      });
      fd.append('images_order', JSON.stringify(ordered_payload));

      // Eliminaciones por id (preferido) y por url (compat)
      if (removedImageIds.length) fd.append('removed_image_ids', JSON.stringify(removedImageIds));
      if (forceDeleteRemoved && removedImageIds.length) {
        // Aplicar eliminación definitiva solo para los ids quitados en esta edición
        fd.append('force_delete_image_ids', JSON.stringify(removedImageIds));
      }

      // Generar variantes por talla con SKU sufijado (codigo-Talla)
      try {
        if (form.sku && sizes && sizes.length) {
          const variants = sizes.map((s) => ({
            size: s,
            sku: `${form.sku}-${s}`,
            stock: Number(sizeStocks?.[s] || 0) || 0,
          }));
          fd.append('variants', JSON.stringify(variants));
        }
      } catch {}

      if (isNew) {
        await inventoryService.createProduct(fd);
        toast.success(t => (
          <div className="flex items-start gap-3">
            <span className="flex-1">Producto creado</span>
            <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
          </div>
        ));
      } else {
        await inventoryService.updateProduct(product.id, fd);
        toast.success(t => (
          <div className="flex items-start gap-3">
            <span className="flex-1">Producto actualizado</span>
            <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
          </div>
        ));
      }
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      let msg = 'No se pudo actualizar el producto';
      const data = err?.response?.data || err;
      if (data?.detail) msg = data.detail; else if (typeof data === 'object') {
        try {
          const parts = [];
          Object.entries(data).forEach(([k, v]) => {
            if (Array.isArray(v)) parts.push(`${k}: ${v.join(', ')}`);
            else if (typeof v === 'string') parts.push(`${k}: ${v}`);
          });
          if (parts.length) msg = parts.join(' | ');
        } catch {}
      }
      toast.error(t => (
        <div className="flex items-start gap-3">
          <span className="flex-1">{msg}</span>
          <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
        </div>
      ));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-6">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Centered modal */}
      <div className="relative w-full max-w-5xl bg-white shadow-2xl border border-gray-200 max-h-full flex flex-col rounded-none">
        <div className="flex items-center justify-between border-b px-4 py-3 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold tracking-wide">{isNew ? 'Nuevo producto' : (infoMode ? 'Información del producto' : 'Editar producto')}</h3>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button className={`btn-outline-slim ${infoMode ? 'bg-gray-900 text-white' : ''}`} onClick={()=> setInfoMode(v=>!v)} disabled={saving}>{infoMode ? 'Editar' : 'Info'}</button>
            )}
            <button className="btn-outline-slim" onClick={onClose} disabled={saving}>Cerrar</button>
            {!infoMode && (
              <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Guardando…' : (isNew ? 'Crear' : 'Guardar')}</button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <div className="py-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Preview */}
            <div className="border border-gray-200">
              {(() => {
                // Combinar existentes + nuevas + librería para el preview principal
                const combined = [
                  ...existingImages.map((it) => (typeof it === 'string' ? { type: 'existing', src: it } : { type: 'existing', src: it.url || it.image || it.src })),
                  ...files.map((f) => ({ type: 'new', file: f })),
                  ...libraryItems.map((it) => ({ type: 'library', source_id: it.id, src: it.url })),
                ].filter((x) => (x.type === 'new' ? !!x.file : !!x.src));
                const idx = Math.min(primaryIndex, Math.max(0, combined.length - 1));
                const current = combined[idx];
                const src = current ? (current.type === 'new' ? URL.createObjectURL(current.file) : current.src) : null;
                return (
                  <div className="aspect-square bg-gray-50 border-b border-gray-200 flex items-center justify-center overflow-hidden">
                    {src ? (
                      <img src={src} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400">Sin imagen</span>
                    )}
                  </div>
                );
              })()}
              <div className="p-3">
                <div className="text-sm text-gray-500">SKU: {form.sku || '—'}</div>
                <div className="text-base font-medium">{form.name || 'Nombre del producto'}</div>
                <div className="text-sm text-gray-600 mt-1">{selectedCategory?.name || 'Sin categoría'}</div>
                <div className="text-sm text-gray-700 mt-2">Bs. {Number(form.price || 0).toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-2">Stock total (calculado): {totalStock}</div>
                {sizes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sizes.map((s) => (
                      <span key={s} className="px-2 py-1 border rounded text-xs">{s}: {Number(sizeStocks[s] || 0)}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              {infoMode ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2"><span className="text-gray-500">Nombre:</span> <span className="font-medium">{form.name || '—'}</span></div>
                  <div><span className="text-gray-500">SKU:</span> <span className="font-medium">{form.sku || '—'}</span></div>
                  <div><span className="text-gray-500">Género:</span> <span className="font-medium">{form.gender === 'M' ? 'Hombre' : form.gender === 'F' ? 'Mujer' : form.gender === 'U' ? 'Unisex' : '—'}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Categoría:</span> <span className="font-medium">{selectedCategory?.name || '—'}</span></div>
                  <div><span className="text-gray-500">Precio:</span> <span className="font-medium">Bs. {Number(form.price || 0).toFixed(2)}</span></div>
                  <div><span className="text-gray-500">Visible:</span> <span className="font-medium">{form.is_active ? 'Sí' : 'No'}</span></div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Colores:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {colors && colors.length ? colors.map((c,i)=> (<span key={`${c}-${i}`} className="px-2 py-1 bg-gray-100 border rounded">{c}</span>)) : <span className="text-gray-400">—</span>}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Tallas y stock:</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {Object.keys(sizeStocks || {}).length ? (
                        Object.keys(sizeStocks).map((s)=> (
                          <span key={s} className="px-2 py-1 border rounded">
                            {s}: {Number(sizeStocks[s] || 0)}
                            {salesBySize[s] !== undefined && (
                              <span className="ml-1 text-green-600 text-xs">
                                (vendidos: {salesBySize[s]})
                              </span>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                    {Object.keys(salesBySize).length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        Total vendido: {Object.values(salesBySize).reduce((a, b) => a + b, 0)} unidades
                      </div>
                    )}
                  </div>
                  {form.description && (
                    <div className="col-span-2"><span className="text-gray-500">Descripción:</span>
                      <p className="mt-1 whitespace-pre-wrap">{form.description}</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Thumbnails existentes + nuevas, con reordenamiento y principal */}
                  <ImageThumbnails
                    existingImages={existingImages}
                    files={files}
                    libraryItems={libraryItems}
                    primaryIndex={primaryIndex}
                    setPrimaryIndex={setPrimaryIndex}
                    setExistingImages={setExistingImages}
                    setFiles={setFiles}
                    setLibraryItems={setLibraryItems}
                    setRemovedImages={setRemovedImages}
                    setRemovedImageIds={setRemovedImageIds}
                    addLibraryItemToOrder={addLibraryItemToOrder}
                    fileInputRef={fileInputRef}
                    openLibrary={() => { setShowLibrary(true); if (!libraryData.length) loadLibrary(); }}
                    openGCSGallery={() => setShowGCSGallery(true)}
                  />
                
                {/* Gestor de galería GCS */}
                {showGCSGallery && (
                  <GCSGalleryModal
                    onClose={() => setShowGCSGallery(false)}
                    onSelectImage={handleGCSImageSelect}
                  />
                )}

                {showLibrary && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowLibrary(false)}>
                    <div className="bg-white w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e)=> e.stopPropagation()}>
                      <div className="flex items-center justify-between border-b px-4 py-2">
                        <h4 className="font-semibold text-sm">Librería de imágenes</h4>
                        <div className="flex items-center gap-2">
                          <button className="btn-outline-slim text-xs" onClick={loadLibrary} disabled={libraryLoading}>{libraryLoading ? 'Cargando…' : 'Refrescar'}</button>
                          <button className="btn-outline-slim text-xs" onClick={()=> setShowLibrary(false)}>Cerrar</button>
                        </div>
                      </div>
                      <div className="p-3 overflow-y-auto flex-1">
                        {libraryLoading && <div className="text-xs text-gray-500">Cargando biblioteca…</div>}
                        {!libraryLoading && libraryData.length === 0 && (
                          <div className="text-xs text-gray-500">Sin imágenes aún</div>
                        )}
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                          {libraryData.map((img) => (
                            <button
                              type="button"
                              key={img.id}
                              onClick={() => addLibraryItemToOrder(img)}
                              className="group relative border border-gray-200 aspect-square overflow-hidden"
                            >
                              <img src={img.url} alt={img.product_sku || 'img'} className="w-full h-full object-cover group-hover:opacity-80" />
                              <div className="absolute inset-x-0 bottom-0 bg-black/50 text-[10px] text-white px-1 py-0.5 flex justify-between">
                                <span className="truncate max-w-[70%]" title={img.product_sku || `#${img.id}`}>{img.product_sku || img.id}</span>
                                <span className="opacity-70">#{img.id}</span>
                              </div>
                              {typeof img.shared_count === 'number' && img.shared_count > 1 && (
                                <span className="absolute top-1 left-1 bg-white/85 text-[10px] px-1 rounded border" title={`Compartida por ${img.shared_count} productos`}>
                                  {img.shared_count}×
                                </span>
                              )}
                              <button
                                type="button"
                                title="Eliminar definitivamente"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!window.confirm('¿Eliminar esta imagen de la librería? Esta acción borra el archivo si no está usado en otros productos.')) return;
                                  inventoryService.deleteLibraryImage(img.id)
                                    .then(() => {
                                      setLibraryData(prev => prev.filter(x => x.id !== img.id));
                                      setLibraryItems(prev => prev.filter(x => x.id !== img.id));
                                      toast.success('Imagen eliminada');
                                    })
                                    .catch(() => toast.error('No se pudo eliminar la imagen'));
                                }}
                                className="absolute top-1 right-1 bg-white/80 text-[10px] px-1 rounded border hover:bg-white"
                              >
                                ×
                              </button>
                            </button>
                          ))}
                        </div>
                      </div>
                      {libraryItems.length > 0 && (
                        <div className="border-t px-4 py-2 text-xs flex flex-wrap gap-2">
                          <span className="text-gray-500">Seleccionadas:</span>
                          {libraryItems.map((li) => (
                            <span key={`sel-${li.id}`} className="px-2 py-1 border rounded flex items-center gap-1 text-[10px]">
                              #{li.id}
                              <button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => setLibraryItems(prev => prev.filter(x => x.id !== li.id))}>×</button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="border-t px-4 py-2 flex justify-end">
                        <button className="btn btn-primary text-xs" onClick={() => setShowLibrary(false)}>Usar seleccionadas</button>
                      </div>
                    </div>
                  </div>
                )}

                  {/* Form */}
                  <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm text-gray-700">Nombre</label>
                <input className="w-full border rounded p-2" value={form.name} onChange={(e)=> setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-gray-700">SKU</label>
                <input className="w-full border rounded p-2" value={form.sku} onChange={(e)=> setForm({...form, sku: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Género</label>
                <select className="w-full border rounded p-2" value={form.gender || ''} onChange={(e)=> setForm({...form, gender: e.target.value})}>
                  <option value="">(Sin especificar)</option>
                  <option value="M">Hombre</option>
                  <option value="F">Mujer</option>
                  <option value="U">Unisex</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700">Precio</label>
                <input type="number" step="0.01" className="w-full border rounded p-2" value={form.price} onChange={(e)=> setForm({...form, price: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-700">Categoría</label>
                <select className="w-full border rounded p-2" value={form.category} onChange={(e)=> setForm({...form, category: e.target.value})}>
                  <option value="">(Sin categoría)</option>
                  {categories.map((c)=>(<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                {selectedCategory && (
                  <div className="text-xs text-gray-500 mt-1">{selectedCategory.gender_display || '—'}{selectedCategory.kind_display ? ` • ${selectedCategory.kind_display}` : ''}</div>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-700">Descripción</label>
                <textarea rows="2" className="w-full border rounded p-2" value={form.description} onChange={(e)=> setForm({...form, description: e.target.value})} />
              </div>

              {/* Colors */}
              <div className="col-span-2">
                <label className="text-sm text-gray-700">Colores</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {colors.map((c, idx) => (
                    <span key={`${c}-${idx}`} className="px-2 py-1 bg-gray-100 border rounded text-sm flex items-center gap-1">
                      {c}
                      <button type="button" className="text-gray-500 hover:text-gray-700" onClick={()=> setColors((prev)=> prev.filter((_,i)=> i!==idx))}>×</button>
                    </span>
                  ))}
                  {['Negro','Blanco','Azul','Rojo','Verde'].map((opt) => (
                    <button key={opt} type="button" onClick={()=> !colors.includes(opt) && setColors(prev=>[...prev, opt])} className="px-2 py-1 border rounded text-xs text-gray-700">
                      + {opt}
                    </button>
                  ))}
                  <input
                    type="text"
                    className="border rounded p-2 text-sm"
                    placeholder="Agregar color y Enter"
                    onKeyDown={(e)=>{
                      if (e.key==='Enter'){
                        e.preventDefault();
                        const v = (e.target.value||'').trim();
                        if (v && !colors.includes(v)) setColors(prev=>[...prev, v]);
                        e.target.value='';
                      }
                    }}
                  />
                </div>
              </div>

              {/* Sizes with per-size stock */}
              <div className="col-span-2">
                <label className="text-sm text-gray-700">Tallas y stock por talla</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {sizes.map((s) => (
                    <div key={s} className="flex items-center gap-2 px-2 py-1 border rounded">
                      <span className="text-xs">{s}</span>
                      <input type="number" min="0" className="w-16 border rounded p-1 text-sm" value={sizeStocks[s] ?? 0} onChange={(e)=> setSizeStocks(m=> ({...m, [s]: e.target.value}))} />
                      <button type="button" className="text-gray-500 hover:text-gray-700" onClick={()=> removeSize(s)}>×</button>
                    </div>
                  ))}
                  {Array.isArray(selectedCategory?.sizes) && selectedCategory.sizes.map((opt) => (
                    <button key={`cat-${opt}`} type="button" onClick={()=> addSize(opt)} className="px-2 py-1 border rounded text-xs text-gray-700">+ {opt}</button>
                  ))}
                  {['XS','S','M','L','XL','XXL','36','38','40','42'].map((opt) => (
                    <button key={`def-${opt}`} type="button" onClick={()=> addSize(opt)} className="px-2 py-1 border rounded text-xs text-gray-700">+ {opt}</button>
                  ))}
                  <input type="text" className="border rounded p-2 text-sm" placeholder="Agregar talla y Enter" value={newSizeInput} onChange={(e)=> setNewSizeInput(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter'){ e.preventDefault(); addSize(newSizeInput); setNewSizeInput(''); } }} />
                </div>
                <div className="text-xs text-gray-500 mt-1">El stock total se calculará como la suma de estas tallas. Para inventario por talla real, se requiere un ajuste en backend.</div>
              </div>

              {/* Images */}
              <div className="col-span-2">
                <label className="text-sm text-gray-700">Imágenes</label>
                <input ref={fileInputRef} hidden multiple type="file" accept="image/*" onChange={(e)=> {
                  const added = Array.from(e.target.files || []);
                  if (added.length) setFiles(prev => [...prev, ...added]);
                  e.target.value = '';
                }} />
                <button type="button" onClick={()=> fileInputRef.current?.click()} className="btn-outline-slim text-xs mt-2">Subir imágenes</button>
                {files.length>0 && (
                  <div className="text-xs text-gray-500 mt-1">Arrastra miniaturas para reordenar. Pulsa “P” para marcar principal. El orden se respetará al guardar.</div>
                )}
                {removedImageIds.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" className="cursor-pointer" checked={forceDeleteRemoved} onChange={(e)=> setForceDeleteRemoved(e.target.checked)} />
                      <span>Eliminar archivos físicamente para {removedImageIds.length} imagen(es) removida(s)</span>
                    </label>
                    <span className="text-gray-400">(Desmarcado: solo se desvinculan del producto)</span>
                  </div>
                )}
              </div>

                    <div className="col-span-2 flex items-center gap-3 mt-2">
                      <input id="visible" type="checkbox" checked={form.is_active} onChange={(e)=> setForm({...form, is_active: e.target.checked})} />
                      <label htmlFor="visible" className="text-sm text-gray-700">Visible</label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductEditModal;
