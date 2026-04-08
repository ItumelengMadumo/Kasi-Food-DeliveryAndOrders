import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../state/authStore';
import { useOrderStore } from '../../state/orderStore';
import { getCustomerOrders } from '../../services/api';
import { OrderStatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner, EmptyState } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import type { Order } from '../../types';

export function OrdersScreen() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { activeOrder } = useOrderStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) loadOrders();
  }, [isAuthenticated, user]);

  async function loadOrders() {
    if (!user || user.isGuest) return;
    setLoading(true);
    try {
      const data = await getCustomerOrders(user.id);
      setOrders(data);
    } catch {
      // Demo fallback
      if (activeOrder) setOrders([activeOrder]);
    } finally {
      setLoading(false);
    }
  }

  const displayOrders = isAuthenticated && !user?.isGuest
    ? orders
    : activeOrder
    ? [activeOrder]
    : [];

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">My Orders</h1>
        {(isAuthenticated || activeOrder) && (
          <button
            onClick={loadOrders}
            className="p-2 text-stone-500 hover:text-stone-800 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        )}
      </div>

      {!isAuthenticated && !activeOrder && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <strong>Sign in</strong> to see your full order history, or{' '}
          <button className="underline font-semibold" onClick={() => navigate('/auth')}>
            sign in here
          </button>
          .
        </div>
      )}

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : displayOrders.length === 0 ? (
        <EmptyState
          icon={<Package size={48} />}
          title="No orders yet"
          description="Start by browsing vendors and placing your first order!"
          action={<Button onClick={() => navigate('/')}>Browse Food</Button>}
        />
      ) : (
        <div className="space-y-3">
          {displayOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </main>
  );
}

function OrderCard({ order }: { order: Order }) {
  const navigate = useNavigate();

  return (
    <div
      className="bg-white rounded-xl border border-stone-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/orders/${order.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/orders/${order.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-stone-900 text-sm">
            Order #{order.id.slice(-8).toUpperCase()}
          </div>
          <div className="text-xs text-stone-400 mt-0.5">
            {new Date(order.createdAt).toLocaleString('en-ZA', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-stone-500">
          {order.deliveryMethod === 'PICKUP' ? '🏪 Pickup' : '🚚 Delivery'} ·{' '}
          {order.paymentMethod === 'DIGITAL' ? '💳 Digital' : '💵 Cash'}
        </span>
        <span className="font-bold text-kasi-orange">R{order.totalAmount.toFixed(2)}</span>
      </div>

      {/* Live status steps */}
      <OrderProgressBar status={order.status} />
    </div>
  );
}

const STATUSES = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
] as const;

function OrderProgressBar({ status }: { status: string }) {
  if (status === 'CANCELLED') {
    return (
      <div className="mt-3 text-xs text-red-500 font-semibold text-center bg-red-50 rounded-lg py-1">
        Order Cancelled
      </div>
    );
  }

  const currentIndex = STATUSES.indexOf(status as typeof STATUSES[number]);

  return (
    <div className="mt-3 flex items-center gap-1">
      {STATUSES.map((s, i) => (
        <div
          key={s}
          className={`flex-1 h-1.5 rounded-full ${
            i <= currentIndex ? 'bg-kasi-orange' : 'bg-stone-100'
          }`}
        />
      ))}
    </div>
  );
}
