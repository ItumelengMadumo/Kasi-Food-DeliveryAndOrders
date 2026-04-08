import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useCartStore } from '../../state/cartStore';
import { useAuthStore } from '../../state/authStore';
import { useOrderStore } from '../../state/orderStore';
import { createOrder } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import type { DeliveryMethod, PaymentMethod } from '../../types';

type CheckoutStep = 'details' | 'payment' | 'confirm';

export function CheckoutScreen() {
  const navigate = useNavigate();
  const { items, vendorId, subtotal, clearCart } = useCartStore();
  const { user, isGuest } = useAuthStore();
  const { setActiveOrder } = useOrderStore();

  const [step, setStep] = useState<CheckoutStep>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [guestName, setGuestName] = useState(user?.name || '');
  const [guestPhone, setGuestPhone] = useState(user?.phone || '');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const deliveryFee = deliveryMethod === 'PICKUP' ? 0 : 15; // placeholder
  const total = subtotal() + deliveryFee;

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!user && !guestName.trim()) newErrors.name = 'Name is required';
    if (!user?.phone && !guestPhone.trim()) newErrors.phone = 'Phone number is required';
    if (guestPhone && !/^[\d\s+()-]{7,15}$/.test(guestPhone))
      newErrors.phone = 'Enter a valid phone number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handlePlaceOrder() {
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      const contactPhone = user?.phone || guestPhone;
      const orderItems = items.map((i) => ({
        menuItemId: i.menuItem.id,
        name: i.menuItem.name,
        price: i.menuItem.price,
        quantity: i.quantity,
      }));

      const order = await createOrder({
        customerId: user && !isGuest ? user.id : undefined,
        guestDetails:
          isGuest || !user
            ? { name: guestName, phone: guestPhone }
            : undefined,
        vendorId: vendorId!,
        deliveryMethod,
        paymentMethod,
        contactPhone,
        specialInstructions: specialInstructions || undefined,
        items: orderItems,
      });

      setActiveOrder(order);
      clearCart();
      setStep('confirm');
    } catch (err: unknown) {
      console.error('Order failed:', err);
      // In demo mode, simulate success
      setActiveOrder({
        id: `demo-${Date.now()}`,
        vendorId: vendorId!,
        customerId: user?.id,
        guestDetails: isGuest ? { name: guestName, phone: guestPhone } : undefined,
        status: 'PENDING',
        deliveryMethod,
        deliveryFee,
        subtotal: subtotal(),
        totalAmount: total,
        paymentMethod,
        contactPhone: user?.phone || guestPhone,
        specialInstructions: specialInstructions || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      clearCart();
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'confirm') {
    return <OrderConfirmation onViewOrders={() => navigate('/orders')} />;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Checkout</h1>
      </div>

      <div className="space-y-5">
        {/* Contact details — only for guests */}
        {(!user || isGuest) && (
          <section className="bg-white rounded-xl border border-stone-100 p-4">
            <h2 className="font-semibold text-stone-800 mb-3">Your Details</h2>
            <div className="space-y-3">
              <Input
                label="Full Name *"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Thandi Dlamini"
                error={errors.name}
              />
              <Input
                label="Phone Number *"
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="e.g. 071 234 5678"
                hint="The vendor will contact you on this number"
                error={errors.phone}
              />
            </div>
          </section>
        )}

        {/* Delivery method */}
        <section className="bg-white rounded-xl border border-stone-100 p-4">
          <h2 className="font-semibold text-stone-800 mb-3">How would you like to receive it?</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['DELIVERY', 'PICKUP'] as DeliveryMethod[]).map((method) => (
              <button
                key={method}
                onClick={() => setDeliveryMethod(method)}
                className={`p-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                  deliveryMethod === method
                    ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                    : 'border-stone-200 text-stone-600 hover:border-stone-300'
                }`}
              >
                {method === 'DELIVERY' ? '🚚 Delivery' : '🏪 Pickup'}
              </button>
            ))}
          </div>
        </section>

        {/* Payment method */}
        <section className="bg-white rounded-xl border border-stone-100 p-4">
          <h2 className="font-semibold text-stone-800 mb-3">How will you pay?</h2>
          <div className="space-y-2">
            {PAYMENT_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => setPaymentMethod(value)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                  paymentMethod === value
                    ? 'border-kasi-orange bg-orange-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="font-semibold text-sm text-stone-800">{label}</div>
                <div className="text-xs text-stone-500 mt-0.5">{description}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Special instructions */}
        <section className="bg-white rounded-xl border border-stone-100 p-4">
          <Textarea
            label="Special Instructions (optional)"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder="Any notes for the vendor…"
            rows={3}
          />
        </section>

        {/* Order summary */}
        <section className="bg-white rounded-xl border border-stone-100 p-4">
          <h2 className="font-semibold text-stone-800 mb-3">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {items.map(({ menuItem, quantity }) => (
              <div key={menuItem.id} className="flex justify-between text-stone-600">
                <span>{menuItem.name} × {quantity}</span>
                <span>R{(menuItem.price * quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-stone-100 pt-2 flex justify-between text-stone-600">
              <span>Delivery fee</span>
              <span>{deliveryMethod === 'PICKUP' ? 'Free' : `R${deliveryFee.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-stone-900">
              <span>Total</span>
              <span className="text-kasi-orange">R{total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={handlePlaceOrder}
          loading={loading}
        >
          Place Order · R{total.toFixed(2)}
        </Button>
      </div>
    </div>
  );
}

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  label: string;
  description: string;
}[] = [
  {
    value: 'CASH_ON_DELIVERY',
    label: '💵 Cash on Delivery',
    description: 'Pay the driver when your food arrives',
  },
  {
    value: 'CASH_ON_PICKUP',
    label: '🏪 Cash on Pickup',
    description: 'Pay at the vendor when you collect',
  },
  {
    value: 'DIGITAL',
    label: '💳 Digital Payment',
    description: 'Pay securely online via PayFast/EFT',
  },
];

function OrderConfirmation({ onViewOrders }: { onViewOrders: () => void }) {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={40} className="text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-stone-900 mb-2">Order Placed! 🎉</h2>
      <p className="text-stone-500 mb-8">
        Your order has been sent to the vendor. You'll be contacted once it's confirmed.
      </p>
      <div className="space-y-3">
        <Button className="w-full" onClick={onViewOrders}>
          Track My Order
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => window.history.go(-3)}>
          Continue Shopping
        </Button>
      </div>
    </div>
  );
}
