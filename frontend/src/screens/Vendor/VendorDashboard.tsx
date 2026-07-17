import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PlusCircle,
  Package,
  Settings,
  ToggleLeft,
  ToggleRight,
  Bell,
  Wallet,
  PencilLine,
  BarChart3,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import { useAuthStore } from '../../state/authStore';
import {
  getVendorMenu,
  getVendorOrders,
  updateOrderStatus,
  toggleMenuItemAvailability,
  deleteMenuItem,
  markOrderPaid,
  createOrder,
  subscribeToNewOrders,
} from '../../services/api';
import { LoadingSpinner } from '../../components/ui/Card';
import { OrderStatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { WhatsAppMenuPreview } from '../../components/WhatsAppMenuPreview';
import type { WhatsAppBankingDetails } from '../../domain/whatsappMenu';
import type { MenuItem, Order, OrderStatus, OrderSource } from '../../types';
import { displayOrderNumber } from '../../domain/orderNumber';

// ── Demo data ──────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────

export function VendorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  // Admins can manage any vendor's dashboard by linking with ?vendorId=... —
  // vendors onboarded by the operator have no Cognito login of their own.
  const overrideVendorId = searchParams.get('vendorId');
  const vendorId =
    (user?.role === 'ADMIN' && overrideVendorId) || user?.id || DEMO_VENDOR_ID;
  const isAdminManaged = user?.role === 'ADMIN' && Boolean(overrideVendorId);
  const withVendorParam = (path: string) =>
    isAdminManaged ? `${path}?vendorId=${vendorId}` : path;

  const [tab, setTab] = useState<'overview' | 'orders' | 'menu' | 'add'>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [deletingMenuItem, setDeletingMenuItem] = useState<string | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null);

  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDemoMode = useRef(false);

  // ── Initial load ──────────────────────────────────────────────────────

  useEffect(() => {
    loadData();
    return () => {
      subscriptionRef.current?.unsubscribe();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [vendorId]);

  async function loadData() {
    setLoading(true);
    try {
      const [o, m] = await Promise.all([getVendorOrders(vendorId), getVendorMenu(vendorId)]);
      setOrders(o);
      setMenu(m);
      isDemoMode.current = false;
      // Start AppSync subscription for real-time updates
      startSubscription();
    } catch {
      isDemoMode.current = true;
      setOrders(DEMO_ORDERS);
      setMenu([
        {
          id: 'm1',
          vendorId,
          name: 'Pap & Wors',
          price: 45,
          available: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'm2',
          vendorId,
          name: 'Chicken Feet',
          price: 30,
          available: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'm3',
          vendorId,
          name: 'Samp & Beans',
          price: 35,
          available: false,
          createdAt: new Date().toISOString(),
        },
      ]);
      // Fall back to polling when subscriptions aren't available
      startPolling();
    } finally {
      setLoading(false);
    }
  }

  // ── AppSync subscription ──────────────────────────────────────────────

  function startSubscription() {
    subscriptionRef.current?.unsubscribe();
    try {
      subscriptionRef.current = subscribeToNewOrders(
        vendorId,
        (newOrder) => {
          setOrders((prev) => {
            if (prev.some((o) => o.id === newOrder.id)) return prev;
            return [newOrder, ...prev];
          });
          const customerName =
            newOrder.guestDetails?.name || `Customer #${newOrder.customerId?.slice(-4)}`;
          setNewOrderAlert(`New order from ${customerName}! 🔔`);
          setTimeout(() => setNewOrderAlert(null), 8000);
        },
        () => {
          // Subscription failed — fall back to polling
          startPolling();
        }
      );
    } catch {
      startPolling();
    }
  }

  // ── Polling fallback (every 10 s) ─────────────────────────────────────

  function startPolling() {
    if (pollingRef.current) return; // already polling
    pollingRef.current = setInterval(async () => {
      try {
        const fresh = await getVendorOrders(vendorId);
        setOrders((prev) => {
          const newOnes = fresh.filter((o) => !prev.some((p) => p.id === o.id));
          if (newOnes.length > 0) {
            const firstName = newOnes[0].guestDetails?.name || 'a customer';
            setNewOrderAlert(`New order from ${firstName}! 🔔`);
            setTimeout(() => setNewOrderAlert(null), 8000);
            return [...newOnes, ...prev];
          }
          // Update statuses for existing orders
          return prev.map((p) => fresh.find((f) => f.id === p.id) || p);
        });
      } catch {
        // silently ignore poll errors
      }
    }, 10_000);
  }

  // ── Order status update ───────────────────────────────────────────────

  async function handleUpdateOrderStatus(orderId: string, newStatus: OrderStatus) {
    setUpdatingOrder(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
    } catch {
      // demo mode — continue with local update
    } finally {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      setUpdatingOrder(null);
    }
  }

  async function handleMarkPaid(orderId: string) {
    setUpdatingOrder(orderId);
    try {
      await markOrderPaid(orderId);
    } catch {
      // demo mode
    } finally {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, paymentStatus: 'PAID' } : o))
      );
      setUpdatingOrder(null);
    }
  }

  // ── Menu toggle ───────────────────────────────────────────────────────

  async function handleToggleItem(itemId: string, available: boolean) {
    try {
      await toggleMenuItemAvailability(itemId, vendorId, !available);
    } catch {
      // demo mode
    } finally {
      setMenu((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, available: !available } : item
        )
      );
    }
  }

  async function handleDeleteMenuItem(itemId: string, itemName: string) {
    const confirmed = window.confirm(
      `Delete \"${itemName}\" from your menu? This will remove it from WhatsApp and the dashboard.`
    );

    if (!confirmed) return;

    setDeletingMenuItem(itemId);
    try {
      await deleteMenuItem(itemId, vendorId);
    } catch {
      // demo mode
    } finally {
      setMenu((prev) => prev.filter((item) => item.id !== itemId));
      setDeletingMenuItem(null);
    }
  }

  // ── Simulated WhatsApp order ──────────────────────────────────────────

  function handleSimulatedOrder(sim: {
    orderId: string;
    customerName: string;
    paymentMethod: 'CASH_ON_PICKUP' | 'EFT' | 'CASH_ON_DELIVERY';
    total: number;
  }) {
    const now = new Date().toISOString();
    const simulatedOrder: Order = {
      id: `sim-${sim.orderId}`,
      vendorId,
      guestDetails: { name: sim.customerName, phone: 'simulated' },
      status: 'PENDING',
      deliveryMethod: sim.paymentMethod === 'CASH_ON_DELIVERY' ? 'DELIVERY' : 'PICKUP',
      deliveryFee: 0,
      subtotal: sim.total,
      totalAmount: sim.total,
      paymentMethod: sim.paymentMethod,
      paymentStatus: 'PENDING',
      contactPhone: 'simulated',
      source: 'WHATSAPP' as OrderSource,
      createdAt: now,
      updatedAt: now,
    };
    setOrders((prev) => [simulatedOrder, ...prev]);
    setNewOrderAlert(
      `Simulated WhatsApp order from ${sim.customerName} • R${sim.total.toFixed(2)} 🧪`
    );
    setTimeout(() => setNewOrderAlert(null), 8000);
  }

  // ── Derived state ─────────────────────────────────────────────────────

  const activeOrders = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status));
  const pastOrders = orders.filter((o) => ['COMPLETED', 'CANCELLED'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const todayOrders = orders.filter((o) => {
    const today = new Date().toDateString();
    return new Date(o.createdAt).toDateString() === today;
  });
  const previewVendorName = user?.name?.trim() || 'Your Shop';
  const bankingDetails = useMemo<WhatsAppBankingDetails | undefined>(() => {
    try {
      const saved = localStorage.getItem(`kasi-vendor-bank-${vendorId}`);
      return saved ? (JSON.parse(saved) as WhatsAppBankingDetails) : undefined;
    } catch {
      return undefined;
    }
  }, [vendorId]);
  const pendingProofs = orders.filter(
    (order) => order.paymentMethod === 'EFT' && order.paymentStatus !== 'PAID'
  ).length;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Vendor Dashboard</h1>
          <p className="text-stone-500 text-sm">Manage your orders and menu</p>
        </div>
        <button
          onClick={() => navigate(withVendorParam('/vendor/settings'))}
          className="p-2 text-stone-500 hover:text-stone-800"
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* New order alert banner */}
      {newOrderAlert && (
        <div className="flex items-center gap-2 bg-kasi-orange text-white rounded-xl px-4 py-3 mb-4 text-sm font-semibold animate-pulse">
          <Bell size={16} />
          {newOrderAlert}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Active Orders" value={activeOrders.length} color="text-kasi-orange" />
        <StatCard label="Menu Items" value={menu.length} color="text-kasi-green" />
        <StatCard
          label="Today's Orders"
          value={
            orders.filter((o) => {
              const today = new Date().toDateString();
              return new Date(o.createdAt).toDateString() === today;
            }).length
          }
          color="text-blue-600"
        />
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-100 rounded-xl p-1 mb-5">
        <TabButton
          label="Overview"
          active={tab === 'overview'}
          onClick={() => setTab('overview')}
          icon={<BarChart3 size={14} className="mr-1" />}
        />
        <TabButton
          label={`Incoming (${activeOrders.length})`}
          active={tab === 'orders'}
          onClick={() => setTab('orders')}
        />
        <TabButton
          label={`Menu (${menu.length})`}
          active={tab === 'menu'}
          onClick={() => setTab('menu')}
        />
        <TabButton
          label="Add Order"
          active={tab === 'add'}
          onClick={() => setTab('add')}
          icon={<Package size={14} className="mr-1" />}
        />
      </div>

      {loading ? (
        <LoadingSpinner className="py-10" />
      ) : tab === 'overview' ? (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Incoming Orders" value={activeOrders.length} hint="Orders needing action right now" icon={<Package size={18} />} />
            <MetricCard title="Completed Orders" value={completedOrders.length} hint="Finished orders recorded in your dashboard" icon={<BarChart3 size={18} />} />
            <MetricCard title="Today's Orders" value={todayOrders.length} hint="Orders placed today" icon={<Bell size={18} />} />
            <MetricCard title="Revenue" value={`R${totalRevenue.toFixed(0)}`} hint="Based on tracked order totals" icon={<Wallet size={18} />} />
          </section>

         

          <section className="bg-white rounded-xl border border-stone-100 p-4">
            <h3 className="font-semibold text-stone-900">Module Overview</h3>
            <p className="mt-1 text-sm text-stone-500">
              This dashboard gives you a quick health check. Open each module below when you need
              detailed actions and full records.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ModuleOverviewRow
                title="Orders"
                summary={`${activeOrders.length} active, ${completedOrders.length} completed`}
                detail="Track status flow from pending to completed, manage payments, and review order timelines."
                actionLabel="Open Orders"
                onClick={() => setTab('orders')}
              />
              <ModuleOverviewRow
                title="Menu"
                summary={`${menu.filter((item) => item.available).length} visible, ${menu.filter((item) => !item.available).length} hidden`}
                detail="Control visibility, pricing, categories, and quick item updates for customer-facing menus."
                actionLabel="Open Menu"
                onClick={() => setTab('menu')}
              />
              <ModuleOverviewRow
                title="WhatsApp"
                summary={`${pendingProofs} EFT payments pending review`}
                detail="Review payment confirmations, track proof status, and manage WhatsApp order channel details."
                actionLabel="Open WhatsApp"
                onClick={() => navigate(withVendorParam('/vendor/whatsapp'))}
              />
              <ModuleOverviewRow
                title="Business Settings"
                summary="Profile, contact, and payout settings"
                detail="Update your operating info, customer contact number, and account details used in payment flows."
                actionLabel="Open Settings"
                onClick={() => navigate(withVendorParam('/vendor/settings'))}
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="bg-white rounded-xl border border-stone-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-stone-900">Recent Incoming Orders</h3>
                  <p className="text-sm text-stone-500">The latest orders waiting for attention</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setTab('orders')}>
                  View All
                </Button>
              </div>
              <div className="space-y-3">
                {activeOrders.length === 0 ? (
                  <p className="text-sm text-stone-400 py-4">No incoming orders right now.</p>
                ) : (
                  activeOrders.slice(0, 3).map((order) => (
                    <CompactOrderRow key={order.id} order={order} />
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-stone-900">Menu and Pricing</h3>
                  <p className="text-sm text-stone-500">Fast access to amend items and pricing</p>
                </div>
                <Button size="sm" onClick={() => navigate(withVendorParam('/vendor/menu/new'))}>
                  <PlusCircle size={14} className="mr-1.5" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-3">
                {menu.length === 0 ? (
                  <p className="text-sm text-stone-400 py-4">No menu items yet.</p>
                ) : (
                  menu.slice(0, 4).map((item) => (
                    <CompactMenuRow
                      key={item.id}
                      item={item}
                      onEdit={() => navigate(withVendorParam(`/vendor/menu/${item.id}/edit`))}
                      onDelete={() => handleDeleteMenuItem(item.id, item.name)}
                      deleting={deletingMenuItem === item.id}
                    />
                  ))
                )}
              </div>
            </div>
          </section>

          <WhatsAppMenuPreviewCard
            menu={menu}
            vendorName={previewVendorName}
            bankingDetails={bankingDetails}
            onSimulatedOrder={handleSimulatedOrder}
          />
        </div>
      ) : tab === 'orders' ? (
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-stone-100 p-4">
            <h3 className="font-semibold text-stone-900">Order Operations Detail</h3>
            <p className="mt-1 text-sm text-stone-500">
              Use this module to process live orders, mark payments, and verify what has already been fulfilled.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Pending" value={orders.filter((o) => o.status === 'PENDING').length} />
              <MiniStat label="Preparing" value={orders.filter((o) => o.status === 'PREPARING').length} />
              <MiniStat label="Ready" value={orders.filter((o) => o.status === 'READY').length} />
              <MiniStat label="Completed" value={completedOrders.length} />
            </div>
          </section>

          {activeOrders.length === 0 ? (
            <p className="text-center text-stone-400 py-8">No active orders right now.</p>
          ) : (
            activeOrders.map((order) => (
              <VendorOrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateOrderStatus}
                onMarkPaid={handleMarkPaid}
                updating={updatingOrder === order.id}
              />
            ))
          )}

          {pastOrders.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-stone-500 mt-6">Completed and Past Orders</h3>
              {pastOrders.slice(0, 5).map((order) => (
                <VendorOrderCard
                  key={order.id}
                  order={order}
                  onUpdateStatus={handleUpdateOrderStatus}
                  onMarkPaid={handleMarkPaid}
                  updating={updatingOrder === order.id}
                />
              ))}
            </>
          )}
        </div>
      ) : tab === 'menu' ? (
        <div>
          <section className="bg-white rounded-xl border border-stone-100 p-4 mb-4">
            <h3 className="font-semibold text-stone-900">Menu Detail View</h3>
            <p className="mt-1 text-sm text-stone-500">
              This module controls exactly what customers can see and order. Toggle availability,
              adjust pricing, and keep categories clean for easier browsing.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Total Items" value={menu.length} />
              <MiniStat label="Visible" value={menu.filter((item) => item.available).length} />
              <MiniStat label="Hidden" value={menu.filter((item) => !item.available).length} />
              <MiniStat
                label="Avg Price"
                value={
                  menu.length
                    ? `R${
                        (menu.reduce((sum, item) => sum + item.price, 0) / menu.length).toFixed(0)
                      }`
                    : 'R0'
                }
              />
            </div>
          </section>

          <div className="flex justify-end mb-4">
            <Button onClick={() => navigate(withVendorParam('/vendor/menu/new'))} size="sm">
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
                onEdit={() => navigate(withVendorParam(`/vendor/menu/${item.id}/edit`))}
                onDelete={() => handleDeleteMenuItem(item.id, item.name)}
                deleting={deletingMenuItem === item.id}
              />
            ))}
          </div>
          <div className="mt-4">
            <WhatsAppMenuPreviewCard
              menu={menu}
              vendorName={previewVendorName}
              bankingDetails={bankingDetails}
              compact
              onSimulatedOrder={handleSimulatedOrder}
            />
          </div>
        </div>
      ) : (
        <ManualOrderForm
          vendorId={vendorId}
          menu={menu}
          onOrderCreated={(order) => {
            setOrders((prev) => [order, ...prev]);
            setTab('orders');
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TabButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center ${
        active ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'
      }`}
    >
      {icon}
      {label}
    </button>
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

function MetricCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-100 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-stone-500">{title}</div>
        <div className="text-kasi-orange">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-bold text-stone-900">{value}</div>
      <p className="mt-1 text-xs text-stone-500">{hint}</p>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  buttonLabel,
  onClick,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-100 p-4">
      <h3 className="font-semibold text-stone-900">{title}</h3>
      <p className="mt-1 text-sm text-stone-500">{description}</p>
      <Button size="sm" className="mt-4" onClick={onClick}>
        {buttonLabel}
      </Button>
    </div>
  );
}

function ModuleOverviewRow({
  title,
  summary,
  detail,
  actionLabel,
  onClick,
}: {
  title: string;
  summary: string;
  detail: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <div className="text-sm font-semibold text-stone-900">{title}</div>
      <div className="mt-1 text-xs font-medium text-kasi-orange">{summary}</div>
      <p className="mt-2 text-xs text-stone-500">{detail}</p>
      <Button size="sm" variant="secondary" className="mt-3" onClick={onClick}>
        {actionLabel}
      </Button>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-lg font-semibold text-stone-900">{value}</div>
    </div>
  );
}

function CompactOrderRow({ order }: { order: Order }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-3 py-3">
      <div>
        <div className="font-semibold text-sm text-stone-900">
          #{displayOrderNumber(order)} • {order.guestDetails?.name || 'Customer'}
        </div>
        <div className="text-xs text-stone-500 mt-0.5">
          {order.deliveryMethod === 'PICKUP' ? 'Pickup' : 'Delivery'} • {new Date(order.createdAt).toLocaleTimeString('en-ZA', { timeStyle: 'short' })}
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-kasi-orange">R{order.totalAmount.toFixed(2)}</div>
        <div className="text-xs text-stone-500">{order.status.replace(/_/g, ' ')}</div>
      </div>
    </div>
  );
}

function CompactMenuRow({
  item,
  onEdit,
  onDelete,
  deleting,
}: {
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-3 py-3">
      <div>
        <div className="font-semibold text-sm text-stone-900">{item.name}</div>
        <div className="text-xs text-stone-500 mt-0.5">
          {item.category || 'Uncategorised'} • {item.available ? 'Visible' : 'Hidden'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="font-semibold text-kasi-orange">R{item.price.toFixed(2)}</div>
        <Button size="sm" variant="secondary" onClick={onEdit}>
          <PencilLine size={14} className="mr-1" />
          Edit
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete} loading={deleting}>
          <Trash2 size={14} className="mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function VendorOrderCard({
  order,
  onUpdateStatus,
  onMarkPaid,
  updating,
}: {
  order: Order;
  onUpdateStatus: (id: string, status: OrderStatus) => void;
  onMarkPaid: (id: string) => void;
  updating: boolean;
}) {
  const nextStatus = NEXT_STATUS[order.status];
  const isPaid = order.paymentStatus === 'PAID';
  const isCashOrder =
    order.paymentMethod === 'CASH_ON_DELIVERY' ||
    order.paymentMethod === 'CASH_ON_PICKUP' ||
    order.paymentMethod === 'EFT' ||
    order.paymentMethod === 'PAYMENT_LINK';

  return (
    <div className="bg-white rounded-xl border border-stone-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-stone-900 text-sm">
            #{displayOrderNumber(order)}
            {order.source === 'WHATSAPP' && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                WhatsApp
              </span>
            )}
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

      <div className="mt-2 text-sm text-stone-600 flex gap-4 flex-wrap">
        <span>{order.deliveryMethod === 'PICKUP' ? '🏪 Pickup' : '🚚 Delivery'}</span>
        <span>
          {order.paymentMethod === 'DIGITAL'
            ? '💳 Digital'
            : order.paymentMethod === 'EFT'
            ? '🏦 EFT'
            : order.paymentMethod === 'PAYMENT_LINK'
            ? '🔗 Payment link'
            : '💵 Cash'}
        </span>
        <span className="font-bold text-kasi-orange">R{order.totalAmount.toFixed(2)}</span>
        {isPaid && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
            Paid ✓
          </span>
        )}
      </div>

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <div className="mt-2 text-xs text-stone-500 space-y-0.5">
          {order.items.map((item) => (
            <div key={item.id}>
              • {item.name} × {item.quantity}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2 flex-wrap">
        {nextStatus && (
          <Button
            size="sm"
            onClick={() => onUpdateStatus(order.id, nextStatus)}
            loading={updating}
            className="flex-1"
          >
            Mark as {nextStatus.replace(/_/g, ' ')}
          </Button>
        )}
        {isCashOrder && !isPaid && order.status !== 'CANCELLED' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onMarkPaid(order.id)}
            loading={updating}
          >
            Mark Paid
          </Button>
        )}
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
    </div>
  );
}

function VendorMenuItem({
  item,
  onToggle,
  onEdit,
  onDelete,
  deleting,
}: {
  item: MenuItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
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
          {item.available ? (
            <ToggleRight size={24} className="text-kasi-green" />
          ) : (
            <ToggleLeft size={24} />
          )}
        </button>
        <Button size="sm" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete} loading={deleting}>
          <Trash2 size={14} className="mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function WhatsAppMenuPreviewCard({
  menu,
  vendorName,
  compact = false,
  bankingDetails,
  onSimulatedOrder,
}: {
  menu: MenuItem[];
  vendorName: string;
  compact?: boolean;
  bankingDetails?: WhatsAppBankingDetails;
  onSimulatedOrder?: (order: {
    orderId: string;
    customerName: string;
    paymentMethod: 'CASH_ON_PICKUP' | 'EFT' | 'CASH_ON_DELIVERY';
    total: number;
  }) => void;
}) {
  return (
    <section className="bg-white rounded-xl border border-stone-100 p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 flex items-center gap-2">
            <MessageCircle size={16} className="text-kasi-green" />
            WhatsApp Menu Preview
          </h3>
          <p className="text-sm text-stone-500">
            Try the live ordering flow — type messages or tap quick replies to
            walk through a complete WhatsApp order.
          </p>
        </div>
        {!compact && (
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Interactive
          </span>
        )}
      </div>
      <WhatsAppMenuPreview
        vendorName={vendorName}
        menuItems={menu}
        bankingDetails={bankingDetails}
        onSimulatedOrder={onSimulatedOrder}
      />
    </section>
  );
}

// ── Manual Order Form ──────────────────────────────────────────────────────

interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

function ManualOrderForm({
  vendorId,
  menu,
  onOrderCreated,
}: {
  vendorId: string;
  menu: MenuItem[];
  onOrderCreated: (order: Order) => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH_ON_PICKUP');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItemId, setSelectedItemId] = useState(menu[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const availableMenu = menu.filter((m) => m.available);

  function addToCart() {
    const item = availableMenu.find((m) => m.id === selectedItemId);
    if (!item) return;
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + quantity } : c
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity }];
    });
  }

  function removeFromCart(menuItemId: string) {
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
  }

  const total = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (!customerPhone.trim()) {
      setError('Customer phone is required.');
      return;
    }
    if (cart.length === 0) {
      setError('Please add at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      const order = await createOrder({
        guestDetails: { name: customerName.trim(), phone: customerPhone.trim() },
        vendorId,
        deliveryMethod,
        paymentMethod,
        contactPhone: customerPhone.trim(),
        items: cart,
      });
      onOrderCreated(order);
    } catch {
      // Demo mode — create a local order object
      const demoOrder: Order = {
        id: `manual-${Date.now()}`,
        vendorId,
        guestDetails: { name: customerName.trim(), phone: customerPhone.trim() },
        status: 'PENDING',
        deliveryMethod,
        deliveryFee: 0,
        subtotal: total,
        totalAmount: total,
        paymentMethod: paymentMethod as Order['paymentMethod'],
        contactPhone: customerPhone.trim(),
        source: 'MANUAL' as OrderSource,
        items: cart.map((c, i) => ({
          id: `item-${i}`,
          orderId: 'demo',
          menuItemId: c.menuItemId,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onOrderCreated(demoOrder);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
        <h3 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
          Customer Details
        </h3>
        <Input
          label="Customer name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="e.g. Sipho Mokoena"
          required
        />
        <Input
          label="Customer phone"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="+27 72 000 0000"
          type="tel"
          required
        />
      </div>

      <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
        <h3 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
          Add Items
        </h3>
        {availableMenu.length === 0 ? (
          <p className="text-stone-400 text-sm">No available menu items.</p>
        ) : (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-stone-700 mb-1">Item</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kasi-orange bg-white text-sm"
              >
                {availableMenu.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — R{item.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className="block text-sm font-medium text-stone-700 mb-1">Qty</label>
              <input
                type="number"
                min={1}
                max={20}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kasi-orange text-sm"
              />
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={addToCart}>
              Add
            </Button>
          </div>
        )}

        {/* Cart lines */}
        {cart.length > 0 && (
          <div className="mt-2 space-y-1">
            {cart.map((line) => (
              <div
                key={line.menuItemId}
                className="flex items-center justify-between text-sm text-stone-700"
              >
                <span>
                  {line.name} ×{line.quantity}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    R{(line.price * line.quantity).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFromCart(line.menuItemId)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <div className="border-t border-stone-100 pt-2 mt-2 flex justify-between font-bold text-stone-900">
              <span>Total</span>
              <span className="text-kasi-orange">R{total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
        <h3 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
          Order Options
        </h3>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Delivery method
          </label>
          <div className="flex gap-2">
            {(['PICKUP', 'DELIVERY'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setDeliveryMethod(m);
                  setPaymentMethod(m === 'PICKUP' ? 'CASH_ON_PICKUP' : 'CASH_ON_DELIVERY');
                }}
                className={`flex-1 py-2 text-sm rounded-lg border font-semibold transition-colors ${
                  deliveryMethod === m
                    ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                    : 'border-stone-200 text-stone-500'
                }`}
              >
                {m === 'PICKUP' ? '🏪 Pickup' : '🚚 Delivery'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Payment method
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kasi-orange bg-white text-sm"
          >
            <option value="CASH_ON_PICKUP">💵 Cash on pickup</option>
            <option value="CASH_ON_DELIVERY">🚚 Cash on delivery</option>
            <option value="EFT">🏦 EFT</option>
            <option value="DIGITAL">💳 Digital payment</option>
            <option value="PAYMENT_LINK">🔗 Payment link</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={submitting}>
        Create Order
      </Button>
    </form>
  );
}

