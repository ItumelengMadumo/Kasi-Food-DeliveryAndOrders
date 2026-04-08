import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Home, Package, User, LogOut, Store } from 'lucide-react';
import { useAuthStore } from '../state/authStore';
import { useCartStore } from '../state/cartStore';
import { clsx } from 'clsx';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const totalItems = useCartStore((s) => s.totalItems());
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-kasi-orange">
          <span className="text-2xl">🍔</span>
          <span>Kasi Eats</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <NavLink to="/" label="Home" icon={<Home size={16} />} active={location.pathname === '/'} />
          {(isAuthenticated || user?.role === 'VENDOR') && (
            <NavLink
              to="/vendor/dashboard"
              label="My Shop"
              icon={<Store size={16} />}
              active={location.pathname.startsWith('/vendor')}
            />
          )}
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/admin"
              label="Admin"
              icon={<User size={16} />}
              active={location.pathname.startsWith('/admin')}
            />
          )}
          <NavLink
            to="/orders"
            label="Orders"
            icon={<Package size={16} />}
            active={location.pathname.startsWith('/orders')}
          />
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-3">
          {/* Cart */}
          <Link
            to="/cart"
            className="relative p-2 text-stone-700 hover:text-kasi-orange transition-colors"
            aria-label="Cart"
          >
            <ShoppingCart size={22} />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-kasi-orange text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>

          {/* Auth */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="hidden md:block text-sm text-stone-600">
                Hi, {user?.name?.split(' ')[0] || 'User'}
              </span>
              <button
                onClick={handleLogout}
                className="p-2 text-stone-500 hover:text-red-500 transition-colors"
                aria-label="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="text-sm font-semibold text-kasi-orange hover:underline"
            >
              {user?.isGuest ? `Hi, ${user.name}` : 'Sign In'}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={clsx(
        'flex items-center gap-1.5 transition-colors',
        active ? 'text-kasi-orange' : 'text-stone-600 hover:text-stone-900'
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

// Mobile bottom navigation
export function BottomNav() {
  const location = useLocation();
  const totalItems = useCartStore((s) => s.totalItems());

  const tabs = [
    { to: '/', label: 'Home', icon: <Home size={22} /> },
    { to: '/orders', label: 'Orders', icon: <Package size={22} /> },
    { to: '/cart', label: 'Cart', icon: <ShoppingCart size={22} />, badge: totalItems },
    { to: '/auth', label: 'Account', icon: <User size={22} /> },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50">
      <div className="grid grid-cols-4 h-16">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className={clsx(
              'flex flex-col items-center justify-center gap-0.5 relative',
              location.pathname === tab.to ? 'text-kasi-orange' : 'text-stone-500'
            )}
          >
            <span className="relative">
              {tab.icon}
              {tab.badge != null && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-kasi-orange text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </span>
            <span className="text-xs">{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
