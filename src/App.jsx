import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { LocationProvider } from './context/LocationContext';
import { useAuth, USER_ROLES } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ROLE_PATHS } from './constants/navigation';
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
import ReservationBookingPage from './pages/Reservations/ReservationBookingPage';
import LoginPage from './pages/Login/LoginPage';
import RegisterPage from './pages/Register/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPassword/ForgotPasswordPage';
import VerifyEmailPage from './pages/VerifyEmail/VerifyEmailPage';
import ProfilePage from './pages/Profile/ProfilePage';
import SettingsPage from './pages/Settings/SettingsPage';
import PartnerApplyPage from './pages/PartnerApply/PartnerApplyPage';
import RiderApplyPage from './pages/RiderApply/RiderApplyPage';
import BusinessPage from './pages/Business/BusinessPage';
import TeamInvitationPage from './pages/Business/TeamInvitationPage';
import RiderPage from './pages/Rider/RiderPage';
import NotFoundPage from './pages/NotFound/NotFoundPage';
import FeatureGatePage from './pages/FeatureGate/FeatureGatePage';

const AdminPage = lazy(() => import('./pages/Admin/AdminPage'));

function HomeGate() {
  const { isLoggedIn, userRole, authLoading, authError, USER_ROLES: roles } = useAuth();
  const location = useLocation();
  const [accessChanged] = useState(() => (
    location.state?.businessAccessChanged
    || window.sessionStorage.getItem('salo.business.accessChanged') === 'true'
  ));
  useEffect(() => {
    if (accessChanged) window.sessionStorage.removeItem('salo.business.accessChanged');
  }, [accessChanged]);
  if (authLoading) return <div className="section-shell"><div className="skeleton-card" /></div>;
  if (authError) return <div className="section-shell" role="alert">{authError}</div>;
  if (!isLoggedIn) {
    return location.hash === '#how-it-works' ? <FeatureGatePage /> : <LandingPage />;
  }
  if (userRole === roles.CUSTOMER) {
    return (
      <>
        {accessChanged ? <p className="business-access-changed" role="status">Your access to this restaurant changed. You’re now in Customer mode.</p> : null}
        <CustomerHomePage />
      </>
    );
  }
  if (userRole === roles.RESTAURANT_OWNER) return <Navigate to="/dashboard" replace />;
  if (userRole === roles.RIDER) return <Navigate to="/rider" replace />;
  if (userRole === roles.ADMIN) return <Navigate to="/admin" replace />;
  return <CustomerHomePage />;
}

function GuestFeatureRoute({ children }) {
  const { isLoggedIn, authLoading, authError } = useAuth();
  if (authLoading) return <div className="section-shell"><div className="skeleton-card" /></div>;
  if (authError) return <div className="section-shell" role="alert">{authError}</div>;
  return isLoggedIn ? children : <FeatureGatePage />;
}

function ReservationBookingRoute() {
  const { isLoggedIn, userRole, authLoading, authError } = useAuth();
  if (authLoading) return <div className="section-shell"><div className="skeleton-card" /></div>;
  if (authError) return <div className="section-shell" role="alert">{authError}</div>;
  if (!isLoggedIn) return <Navigate to="/login?returnTo=%2Freservations%2Fnew" replace />;
  if (userRole !== USER_ROLES.CUSTOMER) return <Navigate to={ROLE_PATHS[userRole] || '/'} replace />;
  return <Layout><ReservationBookingPage /></Layout>;
}

function RequireCapability({ capability, children }) {
  const { isLoggedIn, capabilities, userRole, authLoading, authError } = useAuth();
  const location = useLocation();
  const allowed = capabilities.includes(capability);

  // These client-side guards only improve navigation UX; enforce access in backend Policies.
  if (authLoading) return <div className="section-shell"><div className="skeleton-card" /></div>;
  if (authError) return <div className="section-shell" role="alert">{authError}</div>;
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!allowed) return <Navigate to={ROLE_PATHS[userRole] || '/'} replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <LocationProvider>
              <Routes>
              <Route path="/" element={<Layout><HomeGate /></Layout>} />
              <Route path="/restaurants" element={<Layout><GuestFeatureRoute><RestaurantsPage /></GuestFeatureRoute></Layout>} />
              <Route path="/restaurants/:id" element={<Layout><GuestFeatureRoute><RestaurantDetailPage /></GuestFeatureRoute></Layout>} />
              <Route path="/cart" element={<Layout><GuestFeatureRoute><CartPage /></GuestFeatureRoute></Layout>} />
              <Route path="/checkout" element={<Layout><GuestFeatureRoute><CheckoutPage /></GuestFeatureRoute></Layout>} />
              <Route path="/orders" element={<Layout><GuestFeatureRoute><OrdersPage /></GuestFeatureRoute></Layout>} />
              <Route path="/orders/:id" element={<Layout><GuestFeatureRoute><OrderDetailPage /></GuestFeatureRoute></Layout>} />
              <Route path="/reservations" element={<Layout><GuestFeatureRoute><ReservationsPage /></GuestFeatureRoute></Layout>} />
              <Route path="/reservations/new" element={<ReservationBookingRoute />} />
              <Route path="/reserve" element={<Layout><ReservePage /></Layout>} />
              <Route path="/login" element={<Layout><LoginPage /></Layout>} />
              <Route path="/signup" element={<Layout><RegisterPage /></Layout>} />
              <Route path="/register" element={<Layout><RegisterPage /></Layout>} />
              <Route path="/forgot-password" element={<Layout><ForgotPasswordPage /></Layout>} />
              <Route path="/verify-email" element={<Layout><VerifyEmailPage /></Layout>} />
              <Route path="/profile" element={<Layout><GuestFeatureRoute><ProfilePage /></GuestFeatureRoute></Layout>} />
              <Route path="/settings" element={<Layout><GuestFeatureRoute><SettingsPage /></GuestFeatureRoute></Layout>} />
              <Route path="/partner/apply" element={<Layout><PartnerApplyPage /></Layout>} />
              <Route path="/rider/apply" element={<Layout><RiderApplyPage /></Layout>} />
              <Route path="/dashboard" element={<RequireCapability capability={USER_ROLES.RESTAURANT_OWNER}><Navigate to="/business" replace /></RequireCapability>} />
              <Route path="/business/*" element={<RequireCapability capability={USER_ROLES.RESTAURANT_OWNER}><Layout><BusinessPage /></Layout></RequireCapability>} />
              <Route path="/team-invitations/:token/:action" element={<Layout><TeamInvitationPage /></Layout>} />
              <Route path="/rider" element={<RequireCapability capability={USER_ROLES.RIDER}><Layout><RiderPage /></Layout></RequireCapability>} />
              <Route path="/admin/*" element={<RequireCapability capability={USER_ROLES.ADMIN}><Suspense fallback={<div className="section-shell"><div className="skeleton-card" /></div>}><AdminPage /></Suspense></RequireCapability>} />
              <Route path="*" element={<Layout><NotFoundPage /></Layout>} />
                </Routes>
              </LocationProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
  );
}

export default App;
