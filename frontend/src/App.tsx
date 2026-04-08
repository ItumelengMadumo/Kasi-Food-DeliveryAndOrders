import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { configureAmplify } from './services/amplifyConfigure';
import { Navbar, BottomNav } from './components/Navbar';
import { HomeScreen } from './screens/Home/HomeScreen';
import { VendorDetailsScreen } from './screens/VendorDetails/VendorDetailsScreen';
import { CartScreen } from './screens/Cart/CartScreen';
import { CheckoutScreen } from './screens/Checkout/CheckoutScreen';
import { OrdersScreen } from './screens/Orders/OrdersScreen';
import { AuthScreen } from './modules/auth/AuthScreen';
import { VendorDashboard } from './screens/Vendor/VendorDashboard';
import { VendorApplyScreen } from './screens/Vendor/VendorApplyScreen';
import { AdminDashboard } from './screens/Admin/AdminDashboard';
import { useAuthStore } from './state/authStore';

function App() {
  useEffect(() => {
    try {
      configureAmplify();
    } catch {
      console.warn('Amplify configuration failed — running in demo mode');
    }
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <Routes>
          {/* Customer routes */}
          <Route path="/" element={<HomeScreen />} />
          <Route path="/vendor/:vendorId" element={<VendorDetailsScreen />} />
          <Route path="/cart" element={<CartScreen />} />
          <Route path="/checkout" element={<CheckoutScreen />} />
          <Route path="/orders" element={<OrdersScreen />} />
          <Route path="/orders/:orderId" element={<OrdersScreen />} />

          {/* Auth */}
          <Route path="/auth" element={<AuthScreen />} />

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
        <BottomNav />
      </div>
    </BrowserRouter>
  );
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
