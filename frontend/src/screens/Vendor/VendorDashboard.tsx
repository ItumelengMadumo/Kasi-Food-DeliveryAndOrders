import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Package, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuthStore } from '../../state/authStore';
import { getVendorMenu, getVendorOrders, updateOrderStatus, toggleMenuItemAvailability } from '../../services/api';
import { LoadingSpinner } from '../../components/ui/Card';
import { OrderStatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import type { MenuItem, Order, OrderStatus } from '../../types';

// Demo vendor data for offline mode
const DEMO_VENDOR_ID = 'demo-vendor-1';
const DEMO_ORDERS: Order[] = [
  {
    id: 'order-abc123',
    vendorId: DEMO_VENDOR_ID,
    guestDetails: { name: 'Sipho Mokoena', phone: '072 111 2222' },
    status: 'PENDING',
    deliveryMethod: 'DELIVERY',
    deliveryFee: 15,
    subtotal: 75,
    totalAmount: 90,
    paymentMethod: 'CASH_ON_DELIVERY',
    contactPhone: '072 111 2222',
    createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'order-def456',
    vendorId: DEMO_VENDOR_ID,
    guestDetails: { name: 'Nomvula Zulu', phone: '083 333 4444' },
    status: 'PREPARING',
    deliveryMethod: 'PICKUP',
    deliveryFee: 0,
    subtotal: 120,
    totalAmount: 120,
    paymentMethod: 'CASH_ON_PICKUP',
    contactPhone: '083 333 4444',
    createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'COMPLETED',
};

export function VendorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const vendorId = user?.id ? `vendor_${user.id}` : DEMO_VENDOR_ID;

  const [tab, setTab] = useState<'orders' | 'menu'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  async function loadData() {
    setLoading(true);
    try {
      const [o, m] = await Promise.all([
        getVendorOrders(vendorId),
        getVendorMenu(vendorId),
      ]);
      setOrders(o);
      setMenu(m);
    } catch {
      setOrders(DEMO_ORDERS);
      setMenu([
        { id: 'm1', vendorId, name: 'Pap & Wors', price: 45, available: true, createdAt: new Date().toISOString() },
        { id: 'm2', vendorId, name: 'Chicken Feet', price: 30, available: true, createdAt: new Date().toISOString() },
        { id: 'm3', vendorId, name: 'Samp & Beans', price: 35, available: false, createdAt: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateOrderStatus(orderId: string, newStatus: OrderStatus) {
    setUpdatingOrder(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch {
      // Demo mode: update locally
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } finally {
      setUpdatingOrder(null);
    }
  }

  async function handleToggleItem(itemId: string, available: boolean) {
    try {
      await toggleMenuItemAvailability(itemId, vendorId, !available);
      setMenu((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, available: !available } : item
        )
      );
    } catch {
      setMenu((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, available: !available } : item
        )
      );
    }
  }

  const activeOrders = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status));
  const pastOrders = orders.filter((o) => ['COMPLETED', 'CANCELLED'].includes(o.status));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Vendor Dashboard</h1>
          <p className="text-stone-500 text-sm">Manage your orders and menu</p>
        </div>
        <button
          onClick={() => navigate('/vendor/settings')}
          className="p-2 text-stone-500 hover:text-stone-800"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Active Orders" value={activeOrders.length} color="text-kasi-orange" />
        <StatCard label="Menu Items" value={menu.length} color="text-kasi-green" />
        <StatCard
          label="Today's Orders"
          value={orders.filter((o) => {
            const today = new Date().toDateString();
            return new Date(o.createdAt).toDateString() === today;
          }).length}
          color="text-blue-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-100 rounded-xl p-1 mb-5">
        {(['orders', 'menu'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'
            }`}
          >
            {t === 'orders' ? `Orders (${activeOrders.length})` : `Menu (${menu.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner className="py-10" />
      ) : tab === 'orders' ? (
        <div className="space-y-4">
          {activeOrders.length === 0 ? (
            <p className="text-center text-stone-400 py-8">No active orders right now.</p>
          ) : (
            activeOrders.map((order) => (
              <VendorOrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateOrderStatus}
                updating={updatingOrder === order.id}
              />
            ))
          )}

          {pastOrders.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-stone-500 mt-6">Past Orders</h3>
              {pastOrders.slice(0, 5).map((order) => (
                <VendorOrderCard
                  key={order.id}
                  order={order}
                  onUpdateStatus={handleUpdateOrderStatus}
                  updating={updatingOrder === order.id}
                />
              ))}
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => navigate('/vendor/menu/new')} size="sm">
              <PlusCircle size={16} className="mr-1.5" />
              Add Item
            </Button>
          </div>
          <div className="space-y-3">
            {menu.map((item) => (
              <VendorMenuItem
                key={item.id}
                item={item}
                onToggle={() => handleToggleItem(item.id, item.available)}
                onEdit={() => navigate(`/vendor/menu/${item.id}/edit`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-stone-100 p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-stone-500 mt-0.5">{label}</div>
    </div>
  );
}

function VendorOrderCard({
  order,
  onUpdateStatus,
  updating,
}: {
  order: Order;
  onUpdateStatus: (id: string, status: OrderStatus) => void;
  updating: boolean;
}) {
  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div className="bg-white rounded-xl border border-stone-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-stone-900 text-sm">
            #{order.id.slice(-6).toUpperCase()}
          </div>
          <div className="text-stone-500 text-xs mt-0.5">
            {order.guestDetails
              ? `${order.guestDetails.name} • ${order.guestDetails.phone}`
              : `Customer #${order.customerId?.slice(-6) || 'N/A'}`}
          </div>
          <div className="text-xs text-stone-400 mt-0.5">
            {new Date(order.createdAt).toLocaleTimeString('en-ZA', { timeStyle: 'short' })}
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-2 text-sm text-stone-600 flex gap-4">
        <span>{order.deliveryMethod === 'PICKUP' ? '🏪 Pickup' : '🚚 Delivery'}</span>
        <span>{order.paymentMethod === 'DIGITAL' ? '💳 Digital' : '💵 Cash'}</span>
        <span className="font-bold text-kasi-orange">R{order.totalAmount.toFixed(2)}</span>
      </div>

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <div className="mt-2 text-xs text-stone-500 space-y-0.5">
          {order.items.map((item) => (
            <div key={item.id}>• {item.name} × {item.quantity}</div>
          ))}
        </div>
      )}

      {/* Actions */}
      {nextStatus && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() => onUpdateStatus(order.id, nextStatus)}
            loading={updating}
            className="flex-1"
          >
            Mark as {nextStatus.replace('_', ' ')}
          </Button>
          {order.status === 'PENDING' && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
              loading={updating}
            >
              Reject
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function VendorMenuItem({
  item,
  onToggle,
  onEdit,
}: {
  item: MenuItem;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-100 p-3 flex items-center gap-3">
      {item.imageUrl && (
        <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-lg object-cover" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-stone-900 text-sm">{item.name}</div>
        <div className="text-kasi-orange text-sm font-bold">R{item.price.toFixed(2)}</div>
        {item.category && <div className="text-xs text-stone-400">{item.category}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onToggle} className="text-stone-400 hover:text-stone-800">
          {item.available
            ? <ToggleRight size={24} className="text-kasi-green" />
            : <ToggleLeft size={24} />}
        </button>
        <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
      </div>
    </div>
  );
}
