import { useEffect, useRef, useState } from 'react';

// Lightweight Google Maps + Places Autocomplete loader and picker
// Props:
// - value: { lat?: number, lng?: number, address?: string, city?, state?, country? }
// - onChange: (next: {lat, lng, address, place_id, formatted_address, city?, state?, country?}) => void
// - height: CSS height for map (default 240px)
export default function LocationPicker({ value, onChange, height = 240 }) {
  const runtimeEnv = typeof window !== 'undefined' && window._env_ ? window._env_ : {};
  const apiKey = runtimeEnv.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [loaded, setLoaded] = useState(!!window.google);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (window.google) { setLoaded(true); return; }
    if (!apiKey) { setError('Falta VITE_GOOGLE_MAPS_API_KEY'); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => setError('No se pudo cargar Google Maps');
    document.head.appendChild(script);
    return () => { /* no-op */ };
  }, [apiKey]);

  useEffect(() => {
    if (!loaded || !mapRef.current || mapInstanceRef.current) return;
    try {
      const center = { lat: value?.lat || -17.7833, lng: value?.lng || -63.1821 }; // SCZ por defecto
      const map = new window.google.maps.Map(mapRef.current, { center, zoom: value?.lat ? 15 : 12, disableDoubleClickZoom: true, gestureHandling: 'greedy' });
      mapInstanceRef.current = map;
      const marker = new window.google.maps.Marker({ position: center, map, draggable: true });
      markerRef.current = marker;
      marker.addListener('dragend', async () => {
        const pos = marker.getPosition();
        const lat = pos.lat(); const lng = pos.lng();
        const info = await reverseGeocodeFull(lat, lng);
        const formatted = info?.formatted || value?.address || '';
        onChange && onChange({ lat, lng, address: formatted, place_id: null, formatted_address: formatted, city: info?.city || null, state: info?.state || null, country: info?.country || null });
      });
      const reposition = async (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        marker.setPosition({ lat, lng });
        map.setCenter({ lat, lng });
        const info = await reverseGeocodeFull(lat, lng);
        const formatted = info?.formatted || value?.address || '';
        onChange && onChange({ lat, lng, address: formatted, place_id: null, formatted_address: formatted, city: info?.city || null, state: info?.state || null, country: info?.country || null });
      };
      map.addListener('click', reposition);
      map.addListener('dblclick', reposition);
      if (inputRef.current) {
        const ac = new window.google.maps.places.Autocomplete(inputRef.current, { fields: ['formatted_address','geometry','place_id','address_components'] });
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
            if (!place || !place.geometry) return;
            const loc = place.geometry.location;
            const lat = loc.lat(); const lng = loc.lng();
            map.setCenter({ lat, lng });
            map.setZoom(15);
            marker.setPosition({ lat, lng });
            const comps = extractComponents(place.address_components || []);
            onChange && onChange({ lat, lng, address: place.formatted_address || inputRef.current.value, place_id: place.place_id || null, formatted_address: place.formatted_address || null, city: comps.city, state: comps.state, country: comps.country });
        });
      }
    } catch (e) {
      setError('Error inicializando el mapa');
    }
  }, [loaded]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !value) return;
    if (typeof value.lat === 'number' && typeof value.lng === 'number') {
      const pos = { lat: value.lat, lng: value.lng };
      markerRef.current.setPosition(pos);
      mapInstanceRef.current.setCenter(pos);
    }
  }, [value?.lat, value?.lng]);

    function extractComponents(components) {
      const pick = (types) => (components || []).find(c => c.types?.some(t => types.includes(t)));
      const cityComp = pick(['locality','sublocality','administrative_area_level_2']);
      const stateComp = pick(['administrative_area_level_1']);
      const countryComp = pick(['country']);
      return {
        city: cityComp?.long_name || null,
        state: stateComp?.long_name || null,
        country: countryComp?.short_name || null,
      };
    }
    async function reverseGeocodeFull(lat, lng) {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const res = await geocoder.geocode({ location: { lat, lng } });
        if (res.results && res.results[0]) {
          const r = res.results[0];
          const comps = extractComponents(r.address_components || []);
          return { formatted: r.formatted_address, ...comps };
        }
      } catch {}
      return null;
    }

  if (error) {
    return (
      <div className="text-xs text-red-600">{error}. Agrega tu clave en .env como VITE_GOOGLE_MAPS_API_KEY.</div>
    );
  }
  return (
    <div>
      <input ref={inputRef} defaultValue={value?.address || ''} placeholder="Busca dirección o mueve el marcador" className="border p-2 w-full text-xs mb-2" />
      <div ref={mapRef} style={{ width: '100%', height }} className="border" />
    </div>
  );
}
