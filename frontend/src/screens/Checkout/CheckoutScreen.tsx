import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, LocateFixed } from 'lucide-react';
import { useCartStore } from '../../state/cartStore';
import { useAuthStore } from '../../state/authStore';
import { useOrderStore } from '../../state/orderStore';
import { createOrder, getVendor, initiatePayment } from '../../services/api';
import { getCurrentPosition, type Coordinates } from '../../domain/distance';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import type { DeliveryMethod, PaymentMethod, PaymentProvider, Vendor } from '../../types';

/** Mirrors infra/lambda/createOrder/index.js#calculateDeliveryFee so the UI total never diverges from what's persisted. */
function calculateDeliveryFee(vendor: Vendor | null, subtotal: number, deliveryMethod: DeliveryMethod): number {
  if (deliveryMethod === 'PICKUP') return 0;
  if (!vendor?.deliveryType || vendor.deliveryValue == null) return 15; // fallback flat fee when vendor hasn't configured one
  if (vendor.deliveryType === 'PERCENTAGE') return parseFloat(((vendor.deliveryValue / 100) * subtotal).toFixed(2));
  if (vendor.deliveryType === 'FLAT') return parseFloat(vendor.deliveryValue.toFixed(2));
  return 0;
}

type CheckoutStep = 'details' | 'payment' | 'confirm';

export function CheckoutScreen() {
  const navigate = useNavigate();
  const { items, vendorId, subtotal, clearCart } = useCartStore();
  const { user, isGuest } = useAuthStore();
  const { setActiveOrder } = useOrderStore();

  const [step, setStep] = useState<CheckoutStep>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vendor, setVendor] = useState<Vendor | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    getVendor(vendorId)
      .then(setVendor)
      .catch((err) => console.error('Failed to load vendor for checkout:', err));
  }, [vendorId]);

  // Form state
  const [guestName, setGuestName] = useState(user?.name || '');
  const [guestPhone, setGuestPhone] = useState(user?.phone || '');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('PICKUP');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_ON_PICKUP');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('PAYFAST');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [addressText, setAddressText] = useState('');
  const [landmark, setLandmark] = useState('');
  const [addressLocation, setAddressLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Keep the payment method valid whenever it's no longer offered for the chosen fulfilment method.
  useEffect(() => {
    if (deliveryMethod === 'DELIVERY' && paymentMethod === 'CASH_ON_PICKUP') {
      setPaymentMethod('CASH_ON_DELIVERY');
    } else if (deliveryMethod === 'PICKUP' && paymentMethod === 'CASH_ON_DELIVERY') {
      setPaymentMethod('CASH_ON_PICKUP');
    }
  }, [deliveryMethod, paymentMethod]);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const deliveryFee = calculateDeliveryFee(vendor, subtotal(), deliveryMethod);
  const total = subtotal() + deliveryFee;

  async function handleUseLocation() {
    setLocating(true);
    setLocationError('');
    const pos = await getCurrentPosition();
    if (pos) {
      setAddressLocation(pos);
    } else {
      setLocationError("Couldn't get your location — check that location access is allowed.");
    }
    setLocating(false);
  }

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!guestName.trim()) newErrors.name = 'Name is required';
    if (!guestPhone.trim()) newErrors.phone = 'Phone number is required';
    if (guestPhone && !/^[\d\s+()-]{7,15}$/.test(guestPhone))
      newErrors.phone = 'Enter a valid phone number';
    if (deliveryMethod === 'DELIVERY' && !addressText.trim())
      newErrors.address = 'Delivery address is required';
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
        deliveryAddress:
          deliveryMethod === 'DELIVERY'
            ? {
                text: addressText.trim(),
                landmark: landmark.trim() || undefined,
                lat: addressLocation?.lat,
                lng: addressLocation?.lng,
              }
            : undefined,
        items: orderItems,
      });

      if (paymentMethod === 'DIGITAL') {
        // Redirect to the gateway — don't show the confirmation screen until
        // the customer has actually paid (the webhook flips paymentStatus).
        const { redirectUrl } = await initiatePayment(order.id, paymentProvider);
        clearCart();
        window.location.href = redirectUrl;
        return;
      }

      setActiveOrder(order);
      clearCart();
      setStep('confirm');
    } catch (err: unknown) {
      console.error('Order failed:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong placing your order. Please try again.'
      );
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
        {/* Contact details */}
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

        {/* Delivery method */}
        <section className="bg-white rounded-xl border border-stone-100 p-4">
          <h2 className="font-semibold text-stone-800 mb-3">How would you like to receive it?</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['PICKUP', 'DELIVERY'] as DeliveryMethod[]).map((method) => {
              const disabled = method === 'DELIVERY';
              return (
                <button
                  key={method}
                  disabled={disabled}
                  onClick={() => !disabled && setDeliveryMethod(method)}
                  className={`relative p-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    disabled
                      ? 'border-stone-100 text-stone-400 cursor-not-allowed'
                      : deliveryMethod === method
                        ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                        : 'border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}
                >
                  {method === 'DELIVERY' ? '🚚 Delivery' : '🏪 Pickup'}
                  {disabled && (
                    <span className="absolute top-1 right-1 text-[9px] font-bold uppercase tracking-wide bg-stone-200 text-stone-500 px-1.5 py-0.5 rounded">
                      Coming soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Delivery address */}
        {deliveryMethod === 'DELIVERY' && (
          <section className="bg-white rounded-xl border border-stone-100 p-4">
            <h2 className="font-semibold text-stone-800 mb-3">Where should we deliver?</h2>
            <div className="space-y-3">
              <Textarea
                label="Delivery Address *"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="e.g. 12 Vilakazi Street, Orlando West"
                rows={2}
                error={errors.address}
              />
              <Input
                label="Landmark notes (optional)"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. blue gate opposite the tavern"
              />
              <Button type="button" variant="secondary" onClick={handleUseLocation} loading={locating}>
                <LocateFixed size={16} className="mr-2" />
                {addressLocation ? 'Location captured ✓' : 'Use My Location'}
              </Button>
              {locationError && <p className="text-xs text-red-600">{locationError}</p>}
            </div>
          </section>
        )}

        {/* Payment method */}
        <section className="bg-white rounded-xl border border-stone-100 p-4">
          <h2 className="font-semibold text-stone-800 mb-3">How will you pay?</h2>
          <div className="space-y-2">
            {PAYMENT_OPTIONS.filter(
              (option) => option.value !== 'DIGITAL' || vendor?.digitalPaymentsEnabled
            )
              .filter((option) => option.value !== 'CASH_ON_PICKUP' || deliveryMethod === 'PICKUP')
              .filter((option) => option.value !== 'CASH_ON_DELIVERY' || deliveryMethod === 'DELIVERY')
              .map(({ value, label, description }) => (
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

          {paymentMethod === 'DIGITAL' && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(['PAYFAST', 'OZOW'] as PaymentProvider[]).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => setPaymentProvider(provider)}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    paymentProvider === provider
                      ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                      : 'border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}
                >
                  {provider === 'PAYFAST' ? 'PayFast' : 'Ozow'}
                </button>
              ))}
            </div>
          )}
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
  {
    value: 'PAYMENT_LINK',
    label: '🔗 Payment Link',
    description: 'The vendor will send you a payment link after confirming your order',
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
