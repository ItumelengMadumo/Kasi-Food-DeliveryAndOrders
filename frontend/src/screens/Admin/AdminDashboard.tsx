import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Users, ShoppingBag, Store } from 'lucide-react';
import { getPendingVendorApplications, approveVendor, rejectVendor, getAllOrders } from '../../services/api';
import { LoadingSpinner } from '../../components/ui/Card';
import { OrderStatusBadge } from '../../components/ui/StatusBadge';
import { Button } from '../../components/ui/Button';
import type { VendorApplication, Order } from '../../types';
import { displayOrderNumber } from '../../domain/orderNumber';

export function AdminDashboard() {
  const [tab, setTab] = useState<'applications' | 'orders'>('applications');
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [apps, ords] = await Promise.all([
        getPendingVendorApplications(),
        getAllOrders(),
      ]);
      setApplications(apps);
      setOrders(ords);
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
    try {
      await approveVendor(appId);
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'APPROVED' } : a))
      );
    } catch {
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'APPROVED' } : a))
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(appId: string) {
    setProcessingId(appId);
    try {
      await rejectVendor(appId, 'Does not meet requirements');
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'REJECTED' } : a))
      );
    } catch {
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'REJECTED' } : a))
      );
    } finally {
      setProcessingId(null);
    }
  }

  const pendingApps = applications.filter((a) => a.status === 'PENDING');

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Admin Dashboard</h1>
        <p className="text-stone-500 text-sm">Platform management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pending Applications" value={pendingApps.length} icon={<Clock size={20} />} color="text-yellow-600 bg-yellow-50" />
        <StatCard label="Total Orders" value={orders.length} icon={<ShoppingBag size={20} />} color="text-blue-600 bg-blue-50" />
        <StatCard label="Active Orders" value={orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length} icon={<Store size={20} />} color="text-orange-600 bg-orange-50" />
        <StatCard label="Approved Vendors" value={applications.filter((a) => a.status === 'APPROVED').length} icon={<Users size={20} />} color="text-green-600 bg-green-50" />
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-100 rounded-xl p-1 mb-5">
        <TabButton label={`Applications (${pendingApps.length})`} active={tab === 'applications'} onClick={() => setTab('applications')} />
        <TabButton label={`All Orders (${orders.length})`} active={tab === 'orders'} onClick={() => setTab('orders')} />
      </div>

      {loading ? (
        <LoadingSpinner className="py-10" />
      ) : tab === 'applications' ? (
        <div className="space-y-4">
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
