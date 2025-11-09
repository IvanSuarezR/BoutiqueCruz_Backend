import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import Header from '../components/common/Header.jsx';
import inventoryService from '../services/inventoryService.js';

const genderFromSlug = (slug) => {
  if (!slug) return '';
  const s = String(slug).toLowerCase();
  if (s.startsWith('hom')) return 'M';
  if (s.startsWith('muj')) return 'F';
  if (s.startsWith('uni')) return 'U';
  return '';
};

const parseCatId = (catSlug) => {
  if (!catSlug) return null;
  const parts = String(catSlug).split('-');
  const last = parts[parts.length - 1];
  const id = parseInt(last, 10);
  return Number.isFinite(id) ? id : null;
};

const slugify = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const Browse = () => {
  const params = useParams();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Derivar género desde el primer segmento de la ruta
  const segments = location.pathname.split('/').filter(Boolean);
  const gender = genderFromSlug(segments[0]);
  // ID de categoría desde el parámetro :cat (slug-id)
  const catId = parseCatId(params.cat);

  const currentCat = useMemo(() => categories.find((c) => String(c.id) === String(catId)), [categories, catId]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const cats = await inventoryService.getCategories({ is_active: true });

        // Determinar géneros a traer basados en el contexto mostrado (gender)
        const gendersToFetch = gender === 'M' ? ['M', 'U'] : gender === 'F' ? ['F', 'U'] : gender === 'U' ? ['U'] : [undefined];

        let lists = [];
        for (const g of gendersToFetch) {
          const list = await inventoryService.getProducts({
            is_active: true,
            gender: g || undefined,
            category: catId || undefined,
          });
          lists.push(list || []);
        }

        // Unir y eliminar duplicados por id
        const merged = [];
        const seen = new Set();
        for (const arr of lists) {
          for (const p of arr) {
            if (!seen.has(p.id)) {
              seen.add(p.id);
              merged.push(p);
            }
          }
        }

        setCategories(cats);
        setProducts(merged);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const titleParts = useMemo(() => {
    const gLabel = gender === 'M' ? 'Hombre' : gender === 'F' ? 'Mujer' : gender === 'U' ? 'Unisex' : 'Colección';
    const gSlug = gLabel.toLowerCase();
    const catSlug = currentCat ? `${slugify(currentCat.name)}-${currentCat.id}` : null;
    return { gLabel, gSlug, catLabel: currentCat?.name, catSlug };
  }, [gender, currentCat]);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-4">
          {titleParts.gLabel !== 'Colección' ? (
            <>
              <Link to={`/${titleParts.gSlug}`} className="hover:underline">{titleParts.gLabel}</Link>
              {titleParts.catLabel && (
                <>
                  {' '}
                  <span className="text-gray-400">•</span>
                  {' '}
                  <Link to={`/${titleParts.gSlug}/${titleParts.catSlug}`} className="hover:underline">{titleParts.catLabel}</Link>
                </>
              )}
            </>
          ) : (
            <span>{titleParts.gLabel}</span>
          )}
        </h1>
        {loading ? (
          <div className="text-gray-600">Cargando...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <div
                key={p.id}
                className="group border border-gray-200 rounded-none hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => navigate(`/producto/${p.id}`, { state: { from: location.pathname } })}
              >
                <div className="aspect-square bg-gray-50 border-b border-gray-200 overflow-hidden">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
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
              <div className="text-gray-500">No hay productos para esta selección.</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default Browse;
