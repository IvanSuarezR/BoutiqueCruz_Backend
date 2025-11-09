import { useEffect, useState } from 'react';
import LocationPicker from '../../components/maps/LocationPicker.jsx';

// Reusable modal for creating or editing an address
// Props:
// - open: boolean
// - onClose: () => void
// - initial: address object (optional for create)
// - onSubmit: (payload) => Promise<any>  // parent persists and may return created/updated address
// - title: optional string
// - defaultPhone: optional string to prefill on create
export default function AddressModal({ open, onClose, initial, onSubmit, title, defaultPhone }) {
  const isEdit = Boolean(initial && initial.id);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: '', phone: '', city: '', state: '' });
  const [mapValue, setMapValue] = useState({ lat: null, lng: null, address: '', place_id: null, formatted_address: null, city: null, state: null });

  useEffect(() => {
    if (!open) return;
    const f = {
      label: initial?.label || '',
      phone: initial?.phone || '',
      city: initial?.city || '',
      state: initial?.state || '',
    };
    // Prefill phone on create if empty
    if (!isEdit && !f.phone && defaultPhone) f.phone = defaultPhone;
    setForm(f);
    setMapValue({
      lat: initial?.latitude ? Number(initial.latitude) : null,
      lng: initial?.longitude ? Number(initial.longitude) : null,
      address: initial?.formatted_address || initial?.line1 || '',
      place_id: initial?.place_id || null,
      formatted_address: initial?.formatted_address || null,
      city: initial?.city || null,
      state: initial?.state || null,
    });
  }, [open, initial, defaultPhone]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mapValue.lat || !mapValue.lng) return; // require map selection
    setSaving(true);
    try {
      const lat = mapValue.lat; const lng = mapValue.lng;
      const payload = {
        label: form.label || null,
        phone: form.phone,
        city: form.city || mapValue.city || '',
        state: form.state || mapValue.state || '',
        line1: mapValue.address || mapValue.formatted_address || '',
        latitude: typeof lat === 'number' ? Number(lat.toFixed(6)) : lat,
        longitude: typeof lng === 'number' ? Number(lng.toFixed(6)) : lng,
        place_id: mapValue.place_id || null,
        formatted_address: mapValue.formatted_address || null,
      };
      await onSubmit(payload);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-2xl p-4 border border-gray-900">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">{title || (isEdit ? 'Editar dirección' : 'Agregar dirección')}</h3>
          <button className="btn-outline-slim text-xs" onClick={onClose}>Cerrar</button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <input value={form.label} onChange={e=>setForm(f=>({...f, label:e.target.value}))} placeholder="Nombre ubicación (ej: Casa, Trabajo)" className="border p-2" />
          <input required value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))} placeholder="Teléfono" className="border p-2" />
          <input value={form.city} onChange={e=>setForm(f=>({...f, city:e.target.value}))} placeholder="Ciudad" className="border p-2" />
          <input value={form.state} onChange={e=>setForm(f=>({...f, state:e.target.value}))} placeholder="Estado/Depto" className="border p-2" />
          <div className="md:col-span-2 space-y-2">
            <label className="text-[11px] font-medium">Ubicación en mapa</label>
            <LocationPicker value={mapValue} onChange={(loc)=>{
              setMapValue(loc);
              if (loc.city) setForm(f=>({...f, city: f.city || loc.city }));
              if (loc.state) setForm(f=>({...f, state: f.state || loc.state }));
            }} />
            {mapValue.lat && mapValue.lng && (
              <p className="text-[10px] text-gray-600">Lat: {Number(mapValue.lat).toFixed(5)} Lng: {Number(mapValue.lng).toFixed(5)}</p>
            )}
          </div>
          <div className="md:col-span-2 flex gap-2 justify-end">
            <button type="button" className="btn-outline-slim text-xs" onClick={onClose}>Cancelar</button>
            <button disabled={saving} className="btn text-xs">{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
