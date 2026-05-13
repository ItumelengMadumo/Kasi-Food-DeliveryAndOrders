import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { configureAmplify } from './services/amplifyConfigure';
import { loadAuthenticatedUser } from './services/cognitoAuth';

configureAmplify();
import { Navbar, BottomNav } from './components/Navbar';
import { useAuthStore } from './state/authStore';

const HomeScreen = lazy(() =>
  import('./screens/Home/HomeScreen').then((module) => ({ default: module.HomeScreen }))
);
const VendorDetailsScreen = lazy(() =>
  import('./screens/VendorDetails/VendorDetailsScreen').then((module) => ({
    default: module.VendorDetailsScreen,
  }))
);
const CartScreen = lazy(() =>
  import('./screens/Cart/CartScreen').then((module) => ({ default: module.CartScreen }))
);
const CheckoutScreen = lazy(() =>
  import('./screens/Checkout/CheckoutScreen').then((module) => ({
    default: module.CheckoutScreen,
  }))
);
const OrdersScreen = lazy(() =>
  import('./screens/Orders/OrdersScreen').then((module) => ({ default: module.OrdersScreen }))
);
const AuthScreen = lazy(() =>
  import('./modules/auth/AuthScreen').then((module) => ({ default: module.AuthScreen }))
);
const VendorDashboard = lazy(() =>
  import('./screens/Vendor/VendorDashboard').then((module) => ({
    default: module.VendorDashboard,
  }))
);
const VendorApplyScreen = lazy(() =>
  import('./screens/Vendor/VendorApplyScreen').then((module) => ({
    default: module.VendorApplyScreen,
  }))
);
const VendorMenuEditorScreen = lazy(() =>
  import('./screens/Vendor/VendorMenuEditorScreen').then((module) => ({
    default: module.VendorMenuEditorScreen,
  }))
);
const VendorSettings = lazy(() =>
  import('./screens/Vendor/VendorSettings').then((module) => ({
    default: module.VendorSettings,
  }))
);
const VendorWhatsAppScreen = lazy(() =>
  import('./screens/Vendor/VendorWhatsAppScreen').then((module) => ({
    default: module.VendorWhatsAppScreen,
  }))
);
const AdminDashboard = lazy(() =>
  import('./screens/Admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard }))
);

function App() {
  const { setUser, logout, user } = useAuthStore();

  useEffect(() => {
    let isMounted = true;

    async function restoreAuthSession() {
      const authenticatedUser = await loadAuthenticatedUser();
      if (!isMounted) return;

      if (authenticatedUser) {
        setUser(authenticatedUser);
        return;
      }

      if (user && !user.isGuest) {
        logout();
      }
    }

    void restoreAuthSession();

    return () => {
      isMounted = false;
    };
  }, [logout, setUser, user]);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Customer routes */}
            <Route path="/" element={<HomeRoute />} />
            <Route path="/vendor/:vendorId" element={<VendorDetailsScreen />} />
            <Route path="/cart" element={<CartScreen />} />
            <Route path="/checkout" element={<CheckoutScreen />} />
            <Route path="/orders" element={<OrdersScreen />} />
            <Route path="/orders/:orderId" element={<OrdersScreen />} />

            {/* Auth */}
            <Route path="/auth" element={<AuthRoute />} />

            {/* Vendor routes */}
            <Route path="/vendor/apply" element={<VendorApplyScreen />} />
            <Route
              path="/vendor/dashboard"
              element={
                <ProtectedRoute roles={['VENDOR', 'ADMIN']}>
                  <VendorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendor/settings"
              element={
                <ProtectedRoute roles={['VENDOR', 'ADMIN']}>
                  <VendorSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendor/whatsapp"
              element={
                <ProtectedRoute roles={['VENDOR', 'ADMIN']}>
                  <VendorWhatsAppScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendor/menu/new"
              element={
                <ProtectedRoute roles={['VENDOR', 'ADMIN']}>
                  <VendorMenuEditorScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vendor/menu/:menuItemId/edit"
              element={
                <ProtectedRoute roles={['VENDOR', 'ADMIN']}>
                  <VendorMenuEditorScreen />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

function RouteLoadingFallback() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10 text-sm text-stone-500">
      Loading screen...
    </div>
  );
}

function HomeRoute() {
  return <HomeScreen />;
}

function AuthRoute() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <AuthScreen />;
  }

  if (user.role === 'VENDOR') {
    return <Navigate to="/vendor/dashboard" replace />;
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/" replace />;
}

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles: string[];
}) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default App;
