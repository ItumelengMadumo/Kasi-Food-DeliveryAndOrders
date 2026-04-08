import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useCartStore } from '../../state/cartStore';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Card';

export function CartScreen() {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, clearCart, subtotal, vendorId } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          description="Add some delicious food to get started!"
          action={<Button onClick={() => navigate('/')}>Browse Vendors</Button>}
        />
      </div>
    );
  }

  const deliveryFeeEstimate = 15; // Will be recalculated at checkout
  const total = subtotal() + deliveryFeeEstimate;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Your Cart</h1>
        <button
          onClick={clearCart}
          className="ml-auto text-xs text-red-500 hover:underline"
        >
          Clear all
        </button>
      </div>

      {/* Items list */}
      <div className="space-y-3 mb-6">
        {items.map(({ menuItem, quantity }) => (
          <div key={menuItem.id} className="bg-white rounded-xl border border-stone-100 p-3 flex items-center gap-3">
            {menuItem.imageUrl && (
              <img src={menuItem.imageUrl} alt={menuItem.name} className="w-14 h-14 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-stone-900 text-sm">{menuItem.name}</div>
              <div className="text-kasi-orange font-bold text-sm mt-0.5">
                R{(menuItem.price * quantity).toFixed(2)}
              </div>
              <div className="text-xs text-stone-400">R{menuItem.price.toFixed(2)} each</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(menuItem.id, quantity - 1)}
                className="p-1 rounded-full bg-stone-100 hover:bg-stone-200"
              >
                <Minus size={14} />
              </button>
              <span className="w-5 text-center font-semibold text-sm">{quantity}</span>
              <button
                onClick={() => updateQuantity(menuItem.id, quantity + 1)}
                className="p-1 rounded-full bg-kasi-orange text-white hover:bg-orange-600"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => removeItem(menuItem.id)}
                className="p-1 text-red-400 hover:text-red-600 ml-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-stone-100 p-4 mb-6">
        <h3 className="font-semibold text-stone-700 mb-3">Order Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Subtotal</span>
            <span className="font-semibold">R{subtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Delivery fee</span>
            <span className="text-stone-400 text-xs italic">Calculated at checkout</span>
          </div>
          <div className="border-t border-stone-100 pt-2 flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-kasi-orange">R{subtotal().toFixed(2)}+</span>
          </div>
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={() => navigate('/checkout')}
      >
        <ShoppingBag size={18} className="mr-2" />
        Proceed to Checkout
      </Button>
    </div>
  );
}
