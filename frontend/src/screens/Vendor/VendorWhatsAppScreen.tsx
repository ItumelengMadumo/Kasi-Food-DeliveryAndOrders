import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Smartphone } from 'lucide-react';
import { useAuthStore } from '../../state/authStore';
import { getVendor, getVendorOrders } from '../../services/api';
import { Input, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/Card';
import { displayOrderNumber } from '../../domain/orderNumber';
import type { Order, Vendor } from '../../types';

const DEMO_VENDOR_ID = 'demo-vendor-1';

type ProofStatus = 'PENDING_REVIEW' | 'VERIFIED' | 'FLAGGED';

interface EftProofRecord {
  id: string;
  orderId: string;
  senderPhone: string;
  senderName?: string;
  amount?: number;
  reference?: string;
  note?: string;
  receivedAt: string;
  channel: 'WHATSAPP';
  attachmentName: string;
  status: ProofStatus;
}

const proofStatusClasses: Record<ProofStatus, string> = {
  PENDING_REVIEW: 'bg-amber-50 text-amber-700',
  VERIFIED: 'bg-green-50 text-green-700',
  FLAGGED: 'bg-red-50 text-red-700',
};

export function VendorWhatsAppScreen() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const vendorId = user?.id ? `vendor_${user.id}` : DEMO_VENDOR_ID;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [proofs, setProofs] = useState<EftProofRecord[]>([]);
  const [error, setError] = useState('');

  // Proof intake form
  const [selectedProofOrderId, setSelectedProofOrderId] = useState('');
  const [proofSenderPhone, setProofSenderPhone] = useState('');
  const [proofSenderName, setProofSenderName] = useState('');
  const [proofAmount, setProofAmount] = useState('');
  const [proofReference, setProofReference] = useState('');
  const [proofAttachmentName, setProofAttachmentName] = useState('');
  const [proofNote, setProofNote] = useState('');

  const proofStorageKey = `kasi-vendor-eft-proofs-${vendorId}`;

  const eftOrders = useMemo(
    () => orders.filter((order) => order.paymentMethod === 'EFT'),
    [orders]
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [v, vendorOrders] = await Promise.all([
          getVendor(vendorId),
          getVendorOrders(vendorId),
        ]);
        if (v) setVendor(v);
        setOrders(vendorOrders);
        hydrateProofsFromStorage();
      } catch {
        // Demo fallback
        setOrders(buildDemoOrders(vendorId));
        setProofs(buildDemoProofs(vendorId));
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  function hydrateProofsFromStorage() {
    try {
      const saved = localStorage.getItem(proofStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as EftProofRecord[];
      setProofs(parsed);
    } catch {
      return;
    }
  }

  function persistProofs(nextProofs: EftProofRecord[]) {
    setProofs(nextProofs);
    localStorage.setItem(proofStorageKey, JSON.stringify(nextProofs));
  }

  useEffect(() => {
    if (!selectedProofOrderId && eftOrders.length > 0) {
      setSelectedProofOrderId(eftOrders[0].id);
    }
  }, [eftOrders, selectedProofOrderId]);

  function handleAddProofRecord(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedProofOrderId) {
      setError('Select the EFT order that this proof belongs to.');
      return;
    }
    if (!proofSenderPhone.trim()) {
      setError('Add the sender phone number for the WhatsApp proof.');
      return;
    }
    if (!proofAttachmentName.trim()) {
      setError('Add a filename or label for the proof of payment.');
      return;
    }

    const nextProof: EftProofRecord = {
      id: `proof_${Date.now()}`,
      orderId: selectedProofOrderId,
      senderPhone: proofSenderPhone.trim(),
      senderName: proofSenderName.trim() || undefined,
      amount: proofAmount ? Number(proofAmount) : undefined,
      reference: proofReference.trim() || undefined,
      note: proofNote.trim() || undefined,
      receivedAt: new Date().toISOString(),
      channel: 'WHATSAPP',
      attachmentName: proofAttachmentName.trim(),
      status: 'PENDING_REVIEW',
    };

    persistProofs([nextProof, ...proofs]);
    setError('');
    setProofSenderPhone('');
    setProofSenderName('');
    setProofAmount('');
    setProofReference('');
    setProofAttachmentName('');
    setProofNote('');
  }

  function handleProofStatusChange(proofId: string, status: ProofStatus) {
    const nextProofs = proofs.map((proof) =>
      proof.id === proofId ? { ...proof, status } : proof
    );
    persistProofs(nextProofs);
  }

  if (loading) {
    return <LoadingSpinner className="py-16" />;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/vendor/dashboard')}
          className="p-2 text-stone-500 hover:text-stone-800 -ml-2"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">WhatsApp Ordering</h1>
          <p className="text-stone-500 text-sm">
            {vendor?.name || 'Your restaurant'}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* WhatsApp ordering setup info */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-green-600" />
            <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
              Ordering Channel
            </h2>
          </div>
          <p className="text-sm text-stone-600">
            Customers can order from your business by messaging your WhatsApp number.
            You will receive instant order alerts on the same number.
          </p>
          <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-sm">
            <span className="text-stone-500">WhatsApp number: </span>
            <span className="font-semibold text-stone-900">
              {vendor?.whatsappNumber || 'Not set'}
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Need to change this number? Update it in{' '}
            <button
              type="button"
              className="underline font-semibold"
              onClick={() => navigate('/vendor/settings')}
            >
              Business Settings
            </button>
            .
          </p>
        </section>

        {/* EFT Proofs */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-green-600" />
            <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
              EFT Proofs from WhatsApp
            </h2>
          </div>
          <p className="text-xs text-stone-500">
            Track EFT proofs of payment received over WhatsApp and keep them grouped
            under the right order number.
          </p>

          {eftOrders.length === 0 ? (
            <div className="rounded-xl bg-stone-50 border border-stone-200 px-4 py-4 text-sm text-stone-500">
              No EFT orders yet. Once customers choose EFT, you will be able to track
              their proofs of payment here.
            </div>
          ) : (
            <>
              <form
                onSubmit={handleAddProofRecord}
                className="space-y-4 rounded-xl bg-stone-50 border border-stone-200 p-4"
              >
                <div>
                  <h3 className="font-semibold text-stone-900">
                    Log or review a WhatsApp proof
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Temporary capture flow until WhatsApp attachments are
                    automatically ingested.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    EFT Order
                  </label>
                  <select
                    value={selectedProofOrderId}
                    onChange={(e) => setSelectedProofOrderId(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kasi-orange focus:border-transparent bg-white"
                  >
                    {eftOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        #{displayOrderNumber(order)} •{' '}
                        {order.guestDetails?.name || order.contactPhone} • R
                        {order.totalAmount.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Sender Phone *"
                    value={proofSenderPhone}
                    onChange={(e) => setProofSenderPhone(e.target.value)}
                    placeholder="e.g. +27 72 123 4567"
                  />
                  <Input
                    label="Sender Name"
                    value={proofSenderName}
                    onChange={(e) => setProofSenderName(e.target.value)}
                    placeholder="Optional customer name"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Amount"
                    type="number"
                    step="0.01"
                    value={proofAmount}
                    onChange={(e) => setProofAmount(e.target.value)}
                    placeholder="e.g. 120.00"
                  />
                  <Input
                    label="Reference"
                    value={proofReference}
                    onChange={(e) => setProofReference(e.target.value)}
                    placeholder="Bank ref or customer note"
                  />
                </div>

                <Input
                  label="Proof File or Caption *"
                  value={proofAttachmentName}
                  onChange={(e) => setProofAttachmentName(e.target.value)}
                  placeholder="e.g. pop_sipho_12h30.jpg"
                />

                <Textarea
                  label="Notes"
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  placeholder="Optional notes about the EFT confirmation"
                  rows={3}
                />

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" variant="secondary">
                  Add Proof Record
                </Button>
              </form>

              <div className="space-y-4">
                {eftOrders.map((order) => {
                  const orderProofs = proofs.filter(
                    (proof) => proof.orderId === order.id
                  );

                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border border-stone-200 overflow-hidden"
                    >
                      <div className="bg-stone-50 border-b border-stone-200 px-4 py-3 flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold text-stone-900">
                            Order #{displayOrderNumber(order)} • EFT
                          </div>
                          <div className="text-sm text-stone-500 mt-1">
                            {order.guestDetails?.name || order.contactPhone} • R
                            {order.totalAmount.toFixed(2)} •{' '}
                            {new Date(order.createdAt).toLocaleString('en-ZA', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </div>
                        </div>
                        <div className="text-xs font-semibold rounded-full px-3 py-1 bg-orange-50 text-kasi-orange">
                          {orderProofs.length} proof
                          {orderProofs.length === 1 ? '' : 's'}
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        {orderProofs.length === 0 ? (
                          <p className="text-sm text-stone-500">
                            No WhatsApp proof linked to this EFT order yet.
                          </p>
                        ) : (
                          orderProofs.map((proof) => (
                            <div
                              key={proof.id}
                              className="rounded-xl border border-stone-200 p-4 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-stone-900">
                                    {proof.attachmentName}
                                  </div>
                                  <div className="text-xs text-stone-500 mt-1">
                                    WhatsApp from{' '}
                                    {proof.senderName || proof.senderPhone} •{' '}
                                    {new Date(proof.receivedAt).toLocaleString(
                                      'en-ZA',
                                      {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                      }
                                    )}
                                  </div>
                                </div>
                                <span
                                  className={`text-xs font-semibold rounded-full px-2.5 py-1 ${proofStatusClasses[proof.status]}`}
                                >
                                  {proof.status.replace(/_/g, ' ')}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 gap-2 text-sm text-stone-600 sm:grid-cols-2">
                                <div>
                                  <span className="font-medium text-stone-800">
                                    Sender:
                                  </span>{' '}
                                  {proof.senderPhone}
                                </div>
                                {proof.amount != null && (
                                  <div>
                                    <span className="font-medium text-stone-800">
                                      Amount:
                                    </span>{' '}
                                    R{proof.amount.toFixed(2)}
                                  </div>
                                )}
                                {proof.reference && (
                                  <div className="sm:col-span-2">
                                    <span className="font-medium text-stone-800">
                                      Reference:
                                    </span>{' '}
                                    {proof.reference}
                                  </div>
                                )}
                                {proof.note && (
                                  <div className="sm:col-span-2">
                                    <span className="font-medium text-stone-800">
                                      Notes:
                                    </span>{' '}
                                    {proof.note}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    handleProofStatusChange(proof.id, 'VERIFIED')
                                  }
                                >
                                  Mark Verified
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="border border-stone-300"
                                  onClick={() =>
                                    handleProofStatusChange(
                                      proof.id,
                                      'PENDING_REVIEW'
                                    )
                                  }
                                >
                                  Pending Review
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    handleProofStatusChange(proof.id, 'FLAGGED')
                                  }
                                >
                                  Flag
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function buildDemoOrders(vendorId: string): Order[] {
  return [
    {
      id: 'eft-demo-001',
      vendorId,
      guestDetails: { name: 'Sipho Mokoena', phone: '+27 72 111 2222' },
      status: 'PENDING',
      deliveryMethod: 'PICKUP',
      subtotal: 120,
      totalAmount: 120,
      paymentMethod: 'EFT',
      paymentStatus: 'PENDING',
      contactPhone: '+27 72 111 2222',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'eft-demo-002',
      vendorId,
      guestDetails: { name: 'Nomvula Zulu', phone: '+27 83 333 4444' },
      status: 'ACCEPTED',
      deliveryMethod: 'DELIVERY',
      subtotal: 190,
      totalAmount: 205,
      paymentMethod: 'EFT',
      paymentStatus: 'PENDING',
      contactPhone: '+27 83 333 4444',
      createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function buildDemoProofs(vendorId: string): EftProofRecord[] {
  const demoOrders = buildDemoOrders(vendorId);
  return [
    {
      id: 'proof-demo-001',
      orderId: demoOrders[0].id,
      senderPhone: '+27 72 111 2222',
      senderName: 'Sipho Mokoena',
      amount: 120,
      reference: 'SIPHO120',
      note: 'Customer sent EFT confirmation on WhatsApp after pickup request.',
      receivedAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      channel: 'WHATSAPP',
      attachmentName: 'eft-proof-sipho.jpg',
      status: 'PENDING_REVIEW',
    },
    {
      id: 'proof-demo-002',
      orderId: demoOrders[1].id,
      senderPhone: '+27 83 333 4444',
      senderName: 'Nomvula Zulu',
      amount: 205,
      reference: 'NZULU205',
      note: 'Transfer reflects delivery fee included.',
      receivedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      channel: 'WHATSAPP',
      attachmentName: 'nomvula-pop.pdf',
      status: 'VERIFIED',
    },
  ];
}
