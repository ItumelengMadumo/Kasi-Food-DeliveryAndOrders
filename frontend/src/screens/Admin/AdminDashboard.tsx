import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, Users, ShoppingBag, Store, UserPlus, Settings } from 'lucide-react';
import {
  getPendingVendorApplications,
  approveVendor,
  rejectVendor,
  getAllOrders,
  getAllVendors,
} from '../../services/api';
import { LoadingSpinner } from '../../components/ui/Card';
import { OrderStatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import type { VendorApplication, Order, Vendor } from '../../types';
import { displayOrderNumber } from '../../domain/orderNumber';

export function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'overview' | 'vendors' | 'applications' | 'orders'>('overview');
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [apps, ords, vends] = await Promise.all([
        getPendingVendorApplications(),
        getAllOrders(),
        getAllVendors(),
      ]);
      setApplications(apps);
      setOrders(ords);
      setVendors(vends);
    } catch {
      // Demo data
      setApplications(DEMO_APPLICATIONS);
      setOrders(DEMO_ORDERS);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(appId: string) {
    setProcessingId(appId);
    setActionError('');
    try {
      await approveVendor(appId);
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'APPROVED' } : a))
      );
      loadData();
    } catch (err) {
      console.error('Failed to approve vendor:', err);
      setActionError(
        err instanceof Error ? err.message : 'Could not approve this application.'
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(appId: string) {
    setProcessingId(appId);
    setActionError('');
    try {
      await rejectVendor(appId, 'Does not meet requirements');
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'REJECTED' } : a))
      );
    } catch (err) {
      console.error('Failed to reject vendor:', err);
      setActionError(
        err instanceof Error ? err.message : 'Could not reject this application.'
      );
    } finally {
      setProcessingId(null);
    }
  }

  const pendingApps = applications.filter((a) => a.status === 'PENDING');
  const approvedApps = applications.filter((a) => a.status === 'APPROVED');
  const rejectedApps = applications.filter((a) => a.status === 'REJECTED');
  const activeOrders = orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  const pendingPaymentOrders = orders.filter((o) => o.paymentStatus !== 'PAID');
  const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const todayOrders = orders.filter((o) => {
    const today = new Date().toDateString();
    return new Date(o.createdAt).toDateString() === today;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Admin Dashboard</h1>
          <p className="text-stone-500 text-sm">Platform management</p>
        </div>
        <Button size="sm" onClick={() => navigate('/admin/vendors/new')}>
          <UserPlus size={14} className="mr-1.5" />
          Add Vendor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pending Applications" value={pendingApps.length} icon={<Clock size={20} />} color="text-yellow-600 bg-yellow-50" />
        <StatCard label="Total Orders" value={orders.length} icon={<ShoppingBag size={20} />} color="text-blue-600 bg-blue-50" />
        <StatCard label="Active Orders" value={activeOrders.length} icon={<Store size={20} />} color="text-orange-600 bg-orange-50" />
        <StatCard label="Approved Vendors" value={approvedApps.length} icon={<Users size={20} />} color="text-green-600 bg-green-50" />
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-100 rounded-xl p-1 mb-5">
        <TabButton label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
        <TabButton label={`Vendors (${vendors.length})`} active={tab === 'vendors'} onClick={() => setTab('vendors')} />
        <TabButton label={`Applications (${pendingApps.length})`} active={tab === 'applications'} onClick={() => setTab('applications')} />
        <TabButton label={`All Orders (${orders.length})`} active={tab === 'orders'} onClick={() => setTab('orders')} />
      </div>

      {loading ? (
        <LoadingSpinner className="py-10" />
      ) : tab === 'overview' ? (
        <div className="space-y-5">
          <section className="bg-white rounded-xl border border-stone-100 p-4">
            <h3 className="font-semibold text-stone-900">Operator Overview</h3>
            <p className="mt-1 text-sm text-stone-500">
              This dashboard is your high-level control center. Use each module for deeper review and action when needed.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ModuleOverviewRow
                title="Vendor Applications"
                summary={`${pendingApps.length} pending, ${approvedApps.length} approved, ${rejectedApps.length} rejected`}
                detail="Review onboarding quality, approve qualified vendors, and keep rejection reasons consistent."
                actionLabel="Open Applications"
                onClick={() => setTab('applications')}
              />
              <ModuleOverviewRow
                title="Order Oversight"
                summary={`${activeOrders.length} active, ${todayOrders.length} today, R${totalRevenue.toFixed(0)} total tracked`}
                detail="Monitor platform throughput, check payment state, and verify order lifecycle health across vendors."
                actionLabel="Open Orders"
                onClick={() => setTab('orders')}
              />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="bg-white rounded-xl border border-stone-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-stone-900">Recent Applications</h3>
                  <p className="text-sm text-stone-500">Quick view before opening full onboarding queue</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setTab('applications')}>
                  View Queue
                </Button>
              </div>
              <div className="space-y-3">
                {applications.length === 0 ? (
                  <p className="text-sm text-stone-400 py-4">No applications yet.</p>
                ) : (
                  applications.slice(0, 3).map((app) => <CompactApplicationRow key={app.id} application={app} />)
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-stone-900">Recent Orders</h3>
                  <p className="text-sm text-stone-500">Latest platform orders and current statuses</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setTab('orders')}>
                  View Orders
                </Button>
              </div>
              <div className="space-y-3">
                {orders.length === 0 ? (
                  <p className="text-sm text-stone-400 py-4">No orders yet.</p>
                ) : (
                  orders.slice(0, 3).map((order) => <CompactAdminOrderRow key={order.id} order={order} />)
                )}
              </div>
            </div>
          </section>
        </div>
      ) : tab === 'vendors' ? (
        <div className="space-y-3">
          <section className="bg-white rounded-xl border border-stone-100 p-4">
            <h3 className="font-semibold text-stone-900">All Vendors</h3>
            <p className="mt-1 text-sm text-stone-500">
              Manage any vendor's menu, orders, and settings — including ones onboarded
              without a login of their own.
            </p>
          </section>
          {vendors.length === 0 ? (
            <p className="text-center text-stone-400 py-8">No vendors yet.</p>
          ) : (
            vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="bg-white rounded-xl border border-stone-100 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-stone-900 truncate">{vendor.name}</div>
                  <div className="text-xs text-stone-500 mt-0.5 truncate">
                    {vendor.address}
                    {vendor.whatsappNumber ? ` • ${vendor.whatsappNumber}` : ''}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/vendor/dashboard?vendorId=${vendor.id}`)}
                  >
                    <Store size={14} className="mr-1.5" />
                    Manage
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-stone-300"
                    onClick={() => navigate(`/vendor/settings?vendorId=${vendor.id}`)}
                  >
                    <Settings size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : tab === 'applications' ? (
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-stone-100 p-4">
            <h3 className="font-semibold text-stone-900">Application Review Detail</h3>
            <p className="mt-1 text-sm text-stone-500">
              Use this module to process vendor onboarding with clear decisions and consistent standards.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Pending" value={pendingApps.length} />
              <MiniStat label="Approved" value={approvedApps.length} />
              <MiniStat label="Rejected" value={rejectedApps.length} />
              <MiniStat label="Total" value={applications.length} />
            </div>
          </section>

          {actionError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{actionError}</p>
          )}

          {applications.length === 0 ? (
            <p className="text-center text-stone-400 py-8">No applications yet.</p>
          ) : (
            applications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onApprove={() => handleApprove(app.id)}
                onReject={() => handleReject(app.id)}
                processing={processingId === app.id}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <section className="bg-white rounded-xl border border-stone-100 p-4">
            <h3 className="font-semibold text-stone-900">Order Monitoring Detail</h3>
            <p className="mt-1 text-sm text-stone-500">
              This module is the detailed operational feed for order status, payment state, and platform activity trends.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Active" value={activeOrders.length} />
              <MiniStat label="Completed" value={completedOrders.length} />
              <MiniStat label="Pending Payment" value={pendingPaymentOrders.length} />
              <MiniStat label="Today" value={todayOrders.length} />
            </div>
          </section>

          {orders.length === 0 ? (
            <p className="text-center text-stone-400 py-8">No orders yet.</p>
          ) : (
            orders.map((order) => (
              <AdminOrderRow key={order.id} order={order} />
            ))
          )}
        </div>
      )}
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-lg font-semibold text-stone-900">{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-100 p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${color}`}>{icon}</div>
      <div className="text-2xl font-bold text-stone-900">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
        active ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'
      }`}
    >
      {label}
    </button>
  );
}

function ApplicationCard({
  application,
  onApprove,
  onReject,
  processing,
}: {
  application: VendorApplication;
  onApprove: () => void;
  onReject: () => void;
  processing: boolean;
}) {
  const isPending = application.status === 'PENDING';

  return (
    <div className="bg-white rounded-xl border border-stone-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-stone-900">{application.businessName}</div>
          <div className="text-stone-500 text-sm">{application.applicantName}</div>
          <div className="text-stone-400 text-xs mt-0.5">{application.address}</div>
        </div>
        <StatusPill status={application.status} />
      </div>

      {application.description && (
        <p className="text-stone-500 text-sm mt-2 line-clamp-2">{application.description}</p>
      )}

      <div className="flex gap-3 mt-2 text-sm text-stone-500">
        <span>📞 {application.phone}</span>
        <span>{application.hasBankAccount ? '🏦 Has bank account' : '💵 No bank account'}</span>
      </div>

      {isPending && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={onApprove}
            loading={processing}
            className="flex-1"
          >
            <CheckCircle size={14} className="mr-1.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={onReject}
            loading={processing}
          >
            <XCircle size={14} className="mr-1.5" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config[status] || ''}`}>
      {status}
    </span>
  );
}

function CompactApplicationRow({ application }: { application: VendorApplication }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-3 flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold text-sm text-stone-900">{application.businessName}</div>
        <div className="text-xs text-stone-500 mt-0.5">
          {application.applicantName} • {application.phone}
        </div>
      </div>
      <StatusPill status={application.status} />
    </div>
  );
}

function CompactAdminOrderRow({ order }: { order: Order }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-3 flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold text-sm text-stone-900">#{displayOrderNumber(order)}</div>
        <div className="text-xs text-stone-500 mt-0.5">
          {order.guestDetails
            ? `${order.guestDetails.name} • Guest`
            : `User #${order.customerId?.slice(-6) || 'N/A'}`}
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-kasi-orange">R{order.totalAmount.toFixed(2)}</div>
        <div className="text-xs text-stone-500">{order.status.replace(/_/g, ' ')}</div>
      </div>
    </div>
  );
}

function AdminOrderRow({ order }: { order: Order }) {
  return (
    <div className="bg-white rounded-xl border border-stone-100 p-3 flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold text-stone-900 text-sm">
          #{displayOrderNumber(order)}
        </div>
        <div className="text-xs text-stone-400">
          {order.guestDetails
            ? `${order.guestDetails.name} (Guest)`
            : `User #${order.customerId?.slice(-6)}`}
        </div>
        <div className="text-xs text-stone-400">
          {new Date(order.createdAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <OrderStatusBadge status={order.status} />
        <span className="font-bold text-kasi-orange text-sm">R{order.totalAmount.toFixed(2)}</span>
      </div>
    </div>
  );
}

// Demo data
const DEMO_APPLICATIONS: VendorApplication[] = [
  {
    id: 'app-1',
    applicantName: 'Thandi Dlamini',
    phone: '071 234 5678',
    businessName: "Mama Thandi's Kitchen",
    address: 'Soweto, Johannesburg',
    description: 'Authentic home-cooked meals',
    hasBankAccount: false,
    status: 'PENDING',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'app-2',
    applicantName: 'Sipho Mokoena',
    phone: '082 345 6789',
    businessName: 'Kasi Burger Joint',
    address: 'Tembisa, Ekurhuleni',
    description: 'Juicy kasi-style burgers',
    hasBankAccount: true,
    status: 'PENDING',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: 'app-3',
    applicantName: 'Nomvula Zulu',
    phone: '083 111 2222',
    businessName: 'Spicy Wings Corner',
    address: 'Khayelitsha, Cape Town',
    hasBankAccount: true,
    status: 'APPROVED',
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
];

const DEMO_ORDERS: Order[] = [
  {
    id: 'ord-aaa111',
    vendorId: 'v1',
    guestDetails: { name: 'Sipho M.', phone: '072 111 2222' },
    status: 'PREPARING',
    deliveryMethod: 'DELIVERY',
    deliveryFee: 15,
    subtotal: 75,
    totalAmount: 90,
    paymentMethod: 'CASH_ON_DELIVERY',
    contactPhone: '072 111 2222',
    createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ord-bbb222',
    vendorId: 'v2',
    customerId: 'user-xyz',
    status: 'COMPLETED',
    deliveryMethod: 'PICKUP',
    deliveryFee: 0,
    subtotal: 120,
    totalAmount: 120,
    paymentMethod: 'DIGITAL',
    contactPhone: '083 333 4444',
    createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
