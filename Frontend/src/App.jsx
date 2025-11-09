import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import PrivateRoute from './components/common/PrivateRoute.jsx';
import Home from './pages/Home.jsx';
import Browse from './pages/Browse.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import Roles from './pages/admin/Roles.jsx';
import Products from './pages/inventory/Products.jsx';
import Categories from './pages/inventory/Categories.jsx';
import Cart from './pages/Cart.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Checkout from './pages/Checkout.jsx';
// import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
        <Toaster
          position="top-right"
          containerStyle={{ pointerEvents: 'none', top: 88 }}
          toastOptions={{
            // Allow interacting with the page except directly over the toast
            style: { pointerEvents: 'auto', cursor: 'pointer' },
            // Reasonable defaults; click on a toast will dismiss it
            duration: 4000,
            success: { duration: 3000 },
            error: { duration: 5000 },
          }}
        />
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Navigate to="/" />} />
          {/* Género/categoría navegable */}
          <Route path="/hombre" element={<Browse />} />
          <Route path="/hombre/:cat" element={<Browse />} />
          <Route path="/mujer" element={<Browse />} />
          <Route path="/mujer/:cat" element={<Browse />} />
          <Route path="/unisex" element={<Browse />} />
          <Route path="/unisex/:cat" element={<Browse />} />
          <Route path="/producto/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route
            path="/checkout"
            element={
              <PrivateRoute>
                <Checkout />
              </PrivateRoute>
            }
          />
          
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Rutas privadas */}
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute requirePanel>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <PrivateRoute requirePanel allowedUserTypes={["admin","owner"]}>
                <Roles />
              </PrivateRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <PrivateRoute requirePanel allowedUserTypes={["admin","owner"]}>
                <Products />
              </PrivateRoute>
            }
          />
          <Route
            path="/inventory/categories"
            element={
              <PrivateRoute requirePanel allowedUserTypes={["admin","owner"]}>
                <Categories />
              </PrivateRoute>
            }
          />
          
          {/* Ruta 404 */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;



// esta es una prueba para ver si funciona git hub 
//hola a todos


