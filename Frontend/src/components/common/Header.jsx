import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import inventoryService from '../../services/inventoryService.js';
import UserMenu from './UserMenu.jsx';
import logo from '../../assets/boutiquecruz.png';
import logo2 from '../../assets/boutiquecruzMINI.png';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';

const groupByGenderAndKind = (categories) => {
  const result = { M: { V: [], Z: [] }, F: { V: [], Z: [] }, U: { V: [], Z: [] } };

  const addTo = (genderKey, cat) => {
    const k = cat.kind || null;
    if (k === 'Z') result[genderKey].Z.push(cat);
    else result[genderKey].V.push(cat); // default a Vestir
  };

  categories.forEach((c) => {
    const g = c.gender || 'U';
    if (g === 'U') {
      // Mostrar Unisex también en Hombres y Mujeres
      addTo('U', c);
      addTo('M', c);
      addTo('F', c);
    } else if (g === 'M' || g === 'F') {
      addTo(g, c);
    }
  });

  return result;
};

const slugify = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const Header = () => {
  const navigate = useNavigate();
  const [cats, setCats] = useState([]);
  const { isAuthenticated, canAccessPanel } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const { count } = useCart();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await inventoryService.getCategories({ is_active: true });
        setCats(res);
      } catch (e) {
        // noop
      }
    };
    load();
  }, []);

  const grouped = useMemo(() => groupByGenderAndKind(cats), [cats]);

  const goCategory = (genderCode, cat) => {
    if (!cat) return;
    const slug = slugify(cat.name);
    // Siempre navega por el género desde el que se hizo clic (para U desde Hombre/Mujer mantiene ruta limpia)
    const genderSlug = genderCode === 'M' ? 'hombre' : genderCode === 'F' ? 'mujer' : 'unisex';
    navigate(`/${genderSlug}/${slug}-${cat.id}`);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* Top full-bleed black bar (static, not fixed), forced full viewport width */}
  <div className="w-full bg-black">
  <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between relative">
        {/* Logo left (más grande y rectangular) */}
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex items-center border border-white px-3 h-[70px] overflow-hidden">
            <img src={logo} alt="logo" className="h-full w-auto object-contain pointer-events-none" />
            <span className="sr-only">Inicio</span>
          </Link>
        </div>

  {/* Middle: Gender dropdowns (absolutely centered) */}
  <nav className="hidden md:flex items-center gap-6 text-sm absolute left-1/2 -translate-x-1/2 z-10">
          {/* Hombre */}
          <div className="relative group inline-block">
            <button className="btn-outline-slim border-white text-white" onClick={() => navigate('/hombre')}>Hombre</button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full bg-white border border-gray-200 shadow-sm p-4 grid grid-cols-2 gap-6 min-w-[320px]">
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">Vestir</div>
                <ul className="space-y-1">
                  {grouped.M.V.map((c) => (
                    <li key={c.id}><button className="hover:underline" onClick={() => goCategory('M', c)}>{c.name}</button></li>
                  ))}
                  {grouped.M.V.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">Calzado</div>
                <ul className="space-y-1">
                  {grouped.M.Z.map((c) => (
                    <li key={c.id}><button className="hover:underline" onClick={() => goCategory('M', c)}>{c.name}</button></li>
                  ))}
                  {grouped.M.Z.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                </ul>
              </div>
            </div>
          </div>

          {/* Mujer */}
          <div className="relative group inline-block">
            <button className="btn-outline-slim border-white text-white" onClick={() => navigate('/mujer')}>Mujer</button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full bg-white border border-gray-200 shadow-sm p-4 grid grid-cols-2 gap-6 min-w-[320px]">
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">Vestir</div>
                <ul className="space-y-1">
                  {grouped.F.V.map((c) => (
                    <li key={c.id}><button className="hover:underline" onClick={() => goCategory('F', c)}>{c.name}</button></li>
                  ))}
                  {grouped.F.V.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">Calzado</div>
                <ul className="space-y-1">
                  {grouped.F.Z.map((c) => (
                    <li key={c.id}><button className="hover:underline" onClick={() => goCategory('F', c)}>{c.name}</button></li>
                  ))}
                  {grouped.F.Z.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                </ul>
              </div>
            </div>
          </div>

          {/* Unisex */}
          <div className="relative group inline-block">
            <button className="btn-outline-slim border-white text-white" onClick={() => navigate('/unisex')}>Unisex</button>
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full bg-white border border-gray-200 shadow-sm p-4 grid grid-cols-2 gap-6 min-w-[320px]">
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">Vestir</div>
                <ul className="space-y-1">
                  {grouped.U.V.map((c) => (
                    <li key={c.id}><button className="hover:underline" onClick={() => goCategory('U', c)}>{c.name}</button></li>
                  ))}
                  {grouped.U.V.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2">Calzado</div>
                <ul className="space-y-1">
                  {grouped.U.Z.map((c) => (
                    <li key={c.id}><button className="hover:underline" onClick={() => goCategory('U', c)}>{c.name}</button></li>
                  ))}
                  {grouped.U.Z.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                </ul>
              </div>
            </div>
          </div>
        </nav>

        {/* Right: carrito (bolsa) y perfil */}
        <div className="flex items-center gap-3">
          {/* Botón Carrito / Bolsa */}
          <button
            onClick={() => navigate('/cart')}
            className="btn-outline-slim border-white text-white"
            title="Carrito"
          >
            {/* Icono bolsa */}
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M7 7V6a5 5 0 0110 0v1h1.25a.75.75 0 01.744.648l1.5 12A.75.75 0 0119.75 21H4.25a.75.75 0 01-.744-.852l1.5-12A.75.75 0 015.75 7H7zm1.5 0h7V6a3.5 3.5 0 10-7 0v1z" />
              </svg>
              {count > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] leading-[18px] text-center">{count}</span>
              )}
            </div>
          </button>
          {/* Acceder si no está autenticado */}
          {!isAuthenticated && (
            <button
              onClick={() => navigate('/login')}
              className="btn-outline-slim border-white text-white"
            >
              Acceder
            </button>
          )}

          {/* Panel si tiene acceso al panel */}
          {isAuthenticated && canAccessPanel() && (
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-outline-slim border-white text-white"
            >
              Panel
            </button>
          )}
          {/* Botón Perfil (como antes) */}
          <UserMenu className="btn-outline-slim border-white text-white" />
        </div>
        </div>
      </div>

      {/* Compact sticky header (appears on scroll) */}
      {scrolled && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between relative">
            <div className="flex items-center gap-3">
              <Link to="/" className="inline-flex items-center border border-gray-900 px-2 h-10 overflow-hidden">
                <img src={logo2} alt="logo" className="h-full w-auto object-contain pointer-events-none" />
                <span className="sr-only">Inicio</span>
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-6 text-sm absolute left-1/2 -translate-x-1/2 z-10">
              {/* Hombre (compact) */}
              <div className="relative group inline-block">
                <button className="btn-outline-slim" onClick={() => navigate('/hombre')}>Hombre</button>
                <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full bg-white border border-gray-200 shadow-sm p-4 grid grid-cols-2 gap-6 min-w-[320px]">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2">Vestir</div>
                    <ul className="space-y-1">
                      {grouped.M.V.map((c) => (
                        <li key={c.id}><button className="hover:underline" onClick={() => goCategory('M', c)}>{c.name}</button></li>
                      ))}
                      {grouped.M.V.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2">Calzado</div>
                    <ul className="space-y-1">
                      {grouped.M.Z.map((c) => (
                        <li key={c.id}><button className="hover:underline" onClick={() => goCategory('M', c)}>{c.name}</button></li>
                      ))}
                      {grouped.M.Z.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Mujer (compact) */}
              <div className="relative group inline-block">
                <button className="btn-outline-slim" onClick={() => navigate('/mujer')}>Mujer</button>
                <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full bg-white border border-gray-200 shadow-sm p-4 grid grid-cols-2 gap-6 min-w-[320px]">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2">Vestir</div>
                    <ul className="space-y-1">
                      {grouped.F.V.map((c) => (
                        <li key={c.id}><button className="hover:underline" onClick={() => goCategory('F', c)}>{c.name}</button></li>
                      ))}
                      {grouped.F.V.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2">Calzado</div>
                    <ul className="space-y-1">
                      {grouped.F.Z.map((c) => (
                        <li key={c.id}><button className="hover:underline" onClick={() => goCategory('F', c)}>{c.name}</button></li>
                      ))}
                      {grouped.F.Z.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Unisex (compact) */}
              <div className="relative group inline-block">
                <button className="btn-outline-slim" onClick={() => navigate('/unisex')}>Unisex</button>
                <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full bg-white border border-gray-200 shadow-sm p-4 grid grid-cols-2 gap-6 min-w-[320px]">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2">Vestir</div>
                    <ul className="space-y-1">
                      {grouped.U.V.map((c) => (
                        <li key={c.id}><button className="hover:underline" onClick={() => goCategory('U', c)}>{c.name}</button></li>
                      ))}
                      {grouped.U.V.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2">Calzado</div>
                    <ul className="space-y-1">
                      {grouped.U.Z.map((c) => (
                        <li key={c.id}><button className="hover:underline" onClick={() => goCategory('U', c)}>{c.name}</button></li>
                      ))}
                      {grouped.U.Z.length === 0 && <li className="text-xs text-gray-400">Sin categorías</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </nav>

            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/cart')} className="btn-outline-slim" title="Carrito">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M7 7V6a5 5 0 0110 0v1h1.25a.75.75 0 01.744.648l1.5 12A.75.75 0 0119.75 21H4.25a.75.75 0 01-.744-.852l1.5-12A.75.75 0 015.75 7H7zm1.5 0h7V6a3.5 3.5 0 10-7 0v1z" /></svg>
                  {count > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-gray-900 text-white text-[10px] leading-[18px] text-center">{count}</span>
                  )}
                </div>
              </button>
              {!isAuthenticated && (
                <button onClick={() => navigate('/login')} className="btn-outline-slim">Acceder</button>
              )}
              {isAuthenticated && canAccessPanel() && (
                <button onClick={() => navigate('/dashboard')} className="btn-outline-slim">Panel</button>
              )}
              <UserMenu />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
