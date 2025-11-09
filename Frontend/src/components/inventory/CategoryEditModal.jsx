import { useEffect, useState, useRef } from 'react';
import inventoryService from '../../services/inventoryService.js';
import toast from 'react-hot-toast';

const CategoryEditModal = ({ category, onClose, onSaved, initialInfoMode = false }) => {
  const isNew = !category || !category.id;
  const [saving, setSaving] = useState(false);
  const [infoMode, setInfoMode] = useState(Boolean(initialInfoMode));
  const detailLoadedRef = useRef(false);
  const [form, setForm] = useState({
    name: category?.name || '',
    description: category?.description || '',
    gender: category?.gender || '',
    kind: category?.kind || '',
    sizes: Array.isArray(category?.sizes) ? category.sizes : [],
    is_active: typeof category?.is_active === 'boolean' ? category.is_active : true,
  });

  // Hydrate from detail if missing sizes/description etc.
  useEffect(() => {
    const needFetch = !!(category && category.id && (!Array.isArray(category.sizes) || category.sizes.length === 0));
    if (!needFetch || detailLoadedRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const full = await inventoryService.getCategory(category.id);
        if (cancelled) return;
        setForm(f => ({
          ...f,
          description: full.description || f.description,
          sizes: Array.isArray(full.sizes) ? full.sizes : f.sizes,
        }));
      } catch {}
      detailLoadedRef.current = true;
    })();
    return () => { cancelled = true; };
  }, [category]);

  const updateSizes = (sizes) => setForm(prev => ({ ...prev, sizes }));

  const addSize = (v) => {
    const s = String(v || '').trim();
    if (!s) return;
    updateSizes(form.sizes.includes(s) ? form.sizes : [...form.sizes, s]);
  };
  const removeSize = (idx) => {
    updateSizes(form.sizes.filter((_, i) => i !== idx));
  };

  const onSave = async () => {
    try {
      setSaving(true);
      const payload = { ...form };
      if (!payload.gender) payload.gender = null;
      if (!payload.kind) payload.kind = null;
      if (isNew) {
        await inventoryService.createCategory(payload);
        toast.success(t => (
          <div className="flex items-start gap-3">
            <span className="flex-1">Categoría creada</span>
            <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
          </div>
        ));
      } else {
        await inventoryService.updateCategory(category.id, payload);
        toast.success(t => (
          <div className="flex items-start gap-3">
            <span className="flex-1">Categoría actualizada</span>
            <button onClick={() => toast.dismiss(t.id)} className="btn-outline-slim">Cerrar</button>
          </div>
        ));
      }
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.detail || 'Error al guardar');
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white shadow-2xl border border-gray-200 max-h-full flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold tracking-wide">{isNew ? 'Nueva categoría' : (infoMode ? 'Información de la categoría' : 'Editar categoría')}</h3>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button className={`btn-outline-slim ${infoMode ? 'bg-gray-900 text-white' : ''}`} onClick={() => setInfoMode(v => !v)}>{infoMode ? 'Editar' : 'Info'}</button>
            )}
            <button className="btn-outline-slim" onClick={onClose} disabled={saving}>Cerrar</button>
            {!infoMode && (
              <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Guardando…' : (isNew ? 'Crear' : 'Guardar')}</button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {infoMode ? (
            <div className="py-4 space-y-4 text-sm">
              <div><span className="text-gray-500">Nombre:</span> <span className="font-medium">{form.name || '—'}</span></div>
              <div><span className="text-gray-500">Género:</span> <span className="font-medium">{form.gender === 'M' ? 'Hombre' : form.gender === 'F' ? 'Mujer' : form.gender === 'U' ? 'Unisex' : '—'}</span></div>
              <div><span className="text-gray-500">Tipo:</span> <span className="font-medium">{form.kind === 'V' ? 'Vestir' : form.kind === 'Z' ? 'Calzado' : '—'}</span></div>
              <div><span className="text-gray-500">Activo:</span> <span className="font-medium">{form.is_active ? 'Sí' : 'No'}</span></div>
              <div>
                <span className="text-gray-500">Tallas sugeridas:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {form.sizes && form.sizes.length ? form.sizes.map((s,i)=>(<span key={i} className="px-2 py-1 border rounded">{s}</span>)) : <span className="text-gray-400">—</span>}
                </div>
              </div>
              {form.description && (
                <div>
                  <span className="text-gray-500">Descripción:</span>
                  <p className="mt-1 whitespace-pre-wrap">{form.description}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm text-gray-700">Nombre</label>
                <input className="w-full border rounded p-2" value={form.name} onChange={(e)=> setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-gray-700">Género</label>
                <select className="w-full border rounded p-2" value={form.gender || ''} onChange={(e)=> setForm({...form, gender: e.target.value})}>
                  <option value="">(Sin especificar)</option>
                  <option value="M">Hombre</option>
                  <option value="F">Mujer</option>
                  <option value="U">Unisex</option>
                </select>
                {form.gender === 'U' && <p className="text-xs text-gray-500 mt-1">Aparecerá bajo Hombre y Mujer.</p>}
              </div>
              <div>
                <label className="text-sm text-gray-700">Tipo</label>
                <select className="w-full border rounded p-2" value={form.kind || ''} onChange={(e)=> setForm({...form, kind: e.target.value})}>
                  <option value="">(Sin especificar)</option>
                  <option value="V">Vestir</option>
                  <option value="Z">Calzado</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-700">Descripción</label>
                <textarea rows="2" className="w-full border rounded p-2" value={form.description} onChange={(e)=> setForm({...form, description: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-700">Tallas sugeridas</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {form.sizes.map((sz, idx) => (
                    <span key={`${sz}-${idx}`} className="px-2 py-1 bg-gray-100 border rounded text-sm flex items-center gap-1">
                      {sz}
                      <button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => removeSize(idx)}>×</button>
                    </span>
                  ))}
                  {['XS','S','M','L','XL','XXL','36','38','40','42'].map((opt) => (
                    <button key={opt} type="button" onClick={()=> addSize(opt)} className="px-2 py-1 border rounded text-xs text-gray-700">+ {opt}</button>
                  ))}
                  <input
                    type="text"
                    className="border rounded p-2 text-sm"
                    placeholder="Agregar talla y Enter"
                    onKeyDown={(e)=>{
                      if (e.key==='Enter'){
                        e.preventDefault();
                        const v = (e.target.value||'').trim();
                        if (v && !form.sizes.includes(v)) addSize(v);
                        e.target.value='';
                      }
                    }}
                  />
                </div>
              </div>
              <div className="md:col-span-2 flex items-center gap-2 mt-2">
                <input id="active" type="checkbox" checked={form.is_active} onChange={(e)=> setForm({...form, is_active: e.target.checked})} />
                <label htmlFor="active" className="text-sm text-gray-700">Activo</label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryEditModal;
