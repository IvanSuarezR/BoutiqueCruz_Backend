# Boutique Cruz - AI Agent Instructions

## Architecture Overview

This is a **monorepo** with Django REST backend (`Backend_Boutique/`) and React+Vite frontend (`Frontend/`). The system implements a custom RBAC (Role-Based Access Control) separate from Django's auth system for boutique-specific permissions.

### Key Components

- **Backend**: Django 5.2 + DRF + JWT (simple-jwt) + PostgreSQL/SQLite toggle
- **Frontend**: React 19 + Vite + TailwindCSS + React Router v7
- **Auth**: JWT tokens with refresh mechanism, custom `CustomUser` model extending `AbstractUser`
- **RBAC**: Custom `AppPermission`, `Role`, and many-to-many relations on `CustomUser`

## Critical Architectural Decisions

### Dual Permission Systems

The codebase maintains **two separate permission layers**:

1. **Django Admin (`is_superuser`)**: Reserved exclusively for developers. See `boutique_Main/urls.py` override:
   ```python
   admin.site.has_permission = lambda request: bool(request.user and request.user.is_active and request.user.is_superuser)
   ```

2. **Custom RBAC (`AppPermission` + `Role`)**: For boutique business logic. Managed via `accounts/models.py`:
   - `AppPermission.code` (e.g., `"inventory.manage"`, `"sales.create"`)
   - `Role` with M2M to permissions
   - `CustomUser` with M2M to both `roles` and `app_permissions` (direct grants)
   - Helper: `user_has_permission(user, code)` checks both direct and role-based permissions

### Database Switching Pattern

`settings.py` uses `USE_POSTGRES` env var to toggle between PostgreSQL and SQLite:
```python
if USE_POSTGRES:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', ...}}
else:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', ...}}
```

Load `.env` from `Backend_Boutique/.env` for local overrides.

## Permission System Usage

### Backend Permission Checks

Use custom DRF permission classes from `accounts/permissions.py`:

```python
# Require specific permission for all actions
RequirePermission.with_perms('inventory.manage')

# Allow public read, require permission for write
ReadOnlyOrPermission.with_perms('inventory.manage')
```

Example from `inventory/views.py`:
```python
class CategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated & ReadOnlyOrPermission.with_perms('inventory.manage')]
    
    def get_permissions(self):
        if self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]  # Public catalog browsing
        return super().get_permissions()
```

### Frontend Permission Checks

`AuthContext` exposes `hasAnyPermission(codes)` and `hasAnyRole(names)`:

```jsx
const { hasAnyPermission, canAccessPanel } = useAuth();

// Check permission
if (hasAnyPermission(['inventory.manage'])) { ... }

// Check panel access (admin/superuser only)
if (canAccessPanel()) { ... }
```

Use `<PrivateRoute>` from `components/common/PrivateRoute.jsx`:
```jsx
<PrivateRoute requiredPermissions={['inventory.manage']} requirePanel={true}>
  <ProductManagement />
</PrivateRoute>
```

## Data Model Patterns

### Product Catalog Structure

Products support multiple representations of size/color variants:

1. **Legacy single fields**: `Product.color`, `Product.stock` (top-level aggregation)
2. **JSON arrays**: `Product.colors`, `Product.sizes` (visual display metadata)
3. **Formal variants**: `ProductVariant` model with `size` + `stock` (precise inventory tracking)

When modifying products, handle all three layers. See `inventory/serializers.py` for conversion logic between JSON strings and lists.

### Category Gender/Kind Pattern

Categories use single-char codes with display helpers:
- `gender`: `'M'` (Hombre), `'F'` (Mujer), `'U'` (Unisex)
- `kind`: `'V'` (Vestir), `'Z'` (Calzado)

Products can inherit category gender or override with own `Product.gender` field.

### Media File Handling

Product images use Django's `ImageField` with date-based upload paths: `products/%Y/%m/`. The `ProductImage` model supports galleries with `is_primary` and `sort_order` for multi-image products.

## Development Workflows

### Backend Setup

```powershell
cd Backend_Boutique
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt  # (if exists, otherwise install manually)
python manage.py migrate
python manage.py seed_rbac  # Initialize RBAC permissions and roles
python manage.py createsuperuser  # For developer access only
python manage.py runserver
```

### Frontend Setup

```powershell
cd Frontend
npm install
npm run dev  # Starts Vite dev server on http://localhost:5173
```

### RBAC Seeding

Initialize default permissions/roles: `python manage.py seed_rbac`

Use `--assign-owners` flag to auto-assign "Owner" role to users with `user_type='admin'`.

Default roles created: `Owner`, `Seller`, `Inventory Manager`, `Viewer` (see `accounts/management/commands/seed_rbac.py` for complete permission mapping).

## API Patterns

### Authentication Flow

1. **Login**: `POST /api/auth/login/` → Returns `{access, refresh, user}`
2. **Token Storage**: Frontend stores in `localStorage` (`access_token`, `refresh_token`)
3. **Auto-Refresh**: `axiosConfig.js` interceptor catches 401 and refreshes via `POST /api/auth/token/refresh/`
4. **Logout**: `POST /api/auth/logout/` blacklists refresh token

### RBAC Endpoints

Managed by `accounts/views_rbac.py`:
- `GET /api/auth/roles/` - List roles (admin/superuser only)
- `POST /api/auth/roles/{id}/assign-users/` - Assign users to role
- `POST /api/auth/roles/{id}/grant-permissions/` - Add permissions to role
- `GET /api/auth/me/` - Current user with roles/permissions

### Inventory Filtering

Products/categories support rich query params (see `inventory/views.py`):
- `?q=nombre` - Text search
- `?gender=M|F|U` or `?gender=hombre|mujer|unisex` (aliases supported)
- `?kind=V|Z` or `?kind=vestir|calzado`
- `?category=1` - Filter by category ID
- `?is_active=true` - Active items only

## Spanish Localization

System uses Spanish (Bolivia) locale: `LANGUAGE_CODE = 'es-bo'`, `TIME_ZONE = 'America/La_Paz'`.

User-facing terms:
- Usuario (User), Rol (Role), Permiso (Permission)
- Inventario (Inventory), Producto (Product), Categoría (Category)
- Vendedor (Seller), Cliente (Customer), Proveedor (Supplier)

## Common Pitfalls

1. **Don't confuse Django's `Permission` with `AppPermission`** - They're separate systems
2. **Superusers bypass RBAC checks** - See `user_has_permission()` logic
3. **Product stock is duplicated** - Update both `Product.stock` (aggregate) and `ProductVariant.stock` (per-size)
4. **CORS is pre-configured** - Frontend dev servers on `:5173` and `:5174` are whitelisted
5. **Media files require DEBUG=True** - Or configure proper static serving for production

## Testing Strategy

Currently minimal test coverage (`inventory/tests.py` is stub). When adding tests:
- Use `APITestCase` from DRF for endpoint tests
- Mock RBAC with `user.app_permissions.add(permission)` setup
- Test both superuser and regular user permission paths

## Key Files Reference

- **RBAC Logic**: `accounts/models.py` (`user_has_permission`, `user_roles` helpers)
- **Permission Classes**: `accounts/permissions.py` (`RequirePermission`, `ReadOnlyOrPermission`)
- **Frontend Auth**: `context/AuthContext.jsx` (permission hooks)
- **API Interceptors**: `services/axiosConfig.js` (token refresh logic)
- **Seed Data**: `accounts/management/commands/seed_rbac.py` (default roles/permissions)
