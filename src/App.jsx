import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LocationProvider } from './context/LocationContext';
import { useAuth } from './context/AuthContext';
import LandingPage from './pages/Landing/Landing';
import CustomerHomePage from './pages/CustomerHome/CustomerHomePage';
import RestaurantsPage from './pages/Restaurants/RestaurantsPage';
import RestaurantDetailPage from './pages/RestaurantDetail/RestaurantDetailPage';
import CartPage from './pages/Cart/CartPage';
import CheckoutPage from './pages/Checkout/CheckoutPage';
import OrdersPage from './pages/Orders/OrdersPage';
import OrderDetailPage from './pages/OrderDetail/OrderDetailPage';
import ReservationsPage from './pages/Reservations/ReservationsPage';
import ReservePage from './pages/Reserve/ReservePage';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPassword/ForgotPasswordPage';
import ProfilePage from './pages/Profile/ProfilePage';
import SettingsPage from './pages/Settings/SettingsPage';
import PartnerApplyPage from './pages/PartnerApply/PartnerApplyPage';
import RiderApplyPage from './pages/RiderApply/RiderApplyPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import AdminPage from './pages/Admin/AdminPage';
import RiderPage from './pages/Rider/RiderPage';
import NotFoundPage from './pages/NotFound/NotFoundPage';

function HomeGate() {
  const { isLoggedIn, userRole, USER_ROLES: roles } = useAuth();
  if (!isLoggedIn) return <LandingPage />;
  if (userRole === roles.RESTAURANT_OWNER) return <Navigate to="/dashboard" replace />;
  if (userRole === roles.RIDER) return <Navigate to="/rider" replace />;
  if (userRole === roles.ADMIN) return <Navigate to="/admin" replace />;
  return <CustomerHomePage />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <LocationProvider>
            <Routes>
              <Route path="/" element={<Layout><HomeGate /></Layout>} />
              <Route path="/restaurants" element={<Layout><RestaurantsPage /></Layout>} />
              <Route path="/restaurants/:id" element={<Layout><RestaurantDetailPage /></Layout>} />
              <Route path="/cart" element={<Layout><CartPage /></Layout>} />
              <Route path="/checkout" element={<Layout><CheckoutPage /></Layout>} />
              <Route path="/orders" element={<Layout><OrdersPage /></Layout>} />
              <Route path="/orders/:id" element={<Layout><OrderDetailPage /></Layout>} />
              <Route path="/reservations" element={<Layout><ReservationsPage /></Layout>} />
              <Route path="/reserve" element={<Layout><ReservePage /></Layout>} />
              <Route path="/login" element={<Layout><LoginPage /></Layout>} />
              <Route path="/register" element={<Layout><RegisterPage /></Layout>} />
              <Route path="/forgot-password" element={<Layout><ForgotPasswordPage /></Layout>} />
              <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
              <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
              <Route path="/partner/apply" element={<Layout><PartnerApplyPage /></Layout>} />
              <Route path="/rider/apply" element={<Layout><RiderApplyPage /></Layout>} />
              <Route path="/dashboard" element={<Layout><DashboardPage /></Layout>} />
              <Route path="/rider" element={<Layout><RiderPage /></Layout>} />
              <Route path="/admin" element={<Layout><AdminPage /></Layout>} />
              <Route path="*" element={<Layout><NotFoundPage /></Layout>} />
            </Routes>
          </LocationProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
