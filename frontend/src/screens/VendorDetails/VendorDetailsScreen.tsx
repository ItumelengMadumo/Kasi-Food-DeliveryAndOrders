import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone, MessageCircle, ShoppingCart, Plus, Minus } from 'lucide-react';
import { getVendor, getVendorMenu } from '../../services/api';
import { useCartStore } from '../../state/cartStore';
import { LoadingSpinner } from '../../components/ui/Card';
import { StarRating } from '../../components/ui/StatusBadge';
import { telHref, whatsappHref } from '../../domain/contact';
import type { Vendor, MenuItem } from '../../types';

export function VendorDetailsScreen() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { items, addItem, removeItem, updateQuantity, vendorId: cartVendorId, subtotal } = useCartStore();

  useEffect(() => {
    if (vendorId) loadVendorData(vendorId);
  }, [vendorId]);

  async function loadVendorData(id: string) {
    setLoading(true);
    setError('');
    try {
      const [v, m] = await Promise.all([getVendor(id), getVendorMenu(id)]);
      setVendor(v);
      setMenu(m);
    } catch (err) {
      console.error('Failed to load vendor:', err);
      setError('Could not load this vendor right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  function getCartQuantity(menuItemId: string): number {
    return items.find((i) => i.menuItem.id === menuItemId)?.quantity ?? 0;
  }

  const cartItems = items.filter((i) => i.menuItem.vendorId === vendorId || cartVendorId === vendorId);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!vendor) return <div className="p-8 text-center text-stone-500">Vendor not found.</div>;

  const categories = [...new Set(menu.map((m) => m.category || 'Menu'))];

  return (
    <div className="max-w-3xl mx-auto pb-28 md:pb-8">
      {/* Hero image */}
      <div className="relative h-48 md:h-64 bg-stone-200">
        {vendor.imageUrl ? (
          <img src={vendor.imageUrl} alt={vendor.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl">🍔</div>
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 bg-white rounded-full shadow-md"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      {/* Vendor info */}
      <div className="bg-white px-4 py-5 border-b border-stone-100">
        <h1 className="text-2xl font-bold text-stone-900">{vendor.name}</h1>
        {vendor.description && (
          <p className="text-stone-500 mt-1">{vendor.description}</p>
        )}

        <div className="flex flex-wrap gap-4 mt-3 text-sm text-stone-600">
          {vendor.rating != null && <StarRating rating={vendor.rating} />}

          <span className="flex items-center gap-1">
            <MapPin size={14} className="text-kasi-orange" />
            {vendor.address}
          </span>

          {vendor.contactDetails && (
            <span className="flex items-center gap-1">
              <Phone size={14} className="text-kasi-orange" />
              {vendor.contactDetails}
            </span>
          )}
        </div>

        {/* Direct contact — hands off to the customer's own phone/WhatsApp,
            using the vendor's stored number. No backend involved. */}
        {(vendor.contactDetails || vendor.whatsappNumber) && (
          <div className="mt-3 flex gap-2">
            {vendor.contactDetails && (
              <a
                href={telHref(vendor.contactDetails)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                <Phone size={16} />
                Call
              </a>
            )}
            {vendor.whatsappNumber && (
              <a
                href={whatsappHref(
                  vendor.whatsappNumber,
                  `Hi ${vendor.name}, I'd like to place an order.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                <MessageCircle size={16} />
                WhatsApp
              </a>
            )}
          </div>
        )}

        <div className="mt-3 flex gap-2 flex-wrap text-xs">
          {vendor.deliveryType && vendor.deliveryValue != null && (
            <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-full">
              🚚 {vendor.deliveryType === 'FLAT' ? `R${vendor.deliveryValue}` : `${vendor.deliveryValue}%`} delivery
            </span>
          )}
          {!vendor.hasBankAccount && (
            <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded-full">
              💵 Cash on delivery/pickup
            </span>
          )}
          <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded-full">
            🛍️ Pickup available
          </span>
        </div>
      </div>

      {/* Menu */}
      <div className="px-4 py-4">
        {categories.map((category) => {
          const categoryItems = menu.filter((m) => (m.category || 'Menu') === category);
          return (
            <section key={category} className="mb-6">
              <h2 className="text-lg font-bold text-stone-800 mb-3">{category}</h2>
              <div className="space-y-3">
                {categoryItems.map((item) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    quantity={getCartQuantity(item.id)}
                    onAdd={() => addItem(vendor.id, item)}
                    onRemove={() => {
                      const qty = getCartQuantity(item.id);
                      if (qty <= 1) removeItem(item.id);
                      else updateQuantity(item.id, qty - 1);
                    }}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:bottom-4 md:left-auto md:right-4 md:max-w-sm bg-kasi-orange text-white p-4 md:rounded-xl shadow-xl z-50">
          <button
            onClick={() => navigate('/cart')}
            className="w-full flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={20} />
              <span className="font-semibold">{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
            </span>
            <span className="font-bold">View cart · R{subtotal().toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItemRow({
  item,
  quantity,
  onAdd,
  onRemove,
}: {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 bg-white rounded-xl border border-stone-100 p-3 ${!item.available ? 'opacity-50' : ''}`}>
      {item.imageUrl && (
        <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-stone-900">{item.name}</div>
        {item.description && (
          <div className="text-xs text-stone-500 mt-0.5 line-clamp-2">{item.description}</div>
        )}
        <div className="text-kasi-orange font-bold mt-1">R{item.price.toFixed(2)}</div>
        {!item.available && <div className="text-xs text-red-500 mt-0.5">Currently unavailable</div>}
      </div>

      {item.available && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {quantity > 0 ? (
            <>
              <button
                onClick={onRemove}
                className="p-1 rounded-full bg-stone-100 hover:bg-stone-200"
              >
                <Minus size={16} />
              </button>
              <span className="w-5 text-center font-semibold">{quantity}</span>
              <button
                onClick={onAdd}
                className="p-1 rounded-full bg-kasi-orange text-white hover:bg-orange-600"
              >
                <Plus size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={onAdd}
              className="p-1.5 rounded-full bg-kasi-orange text-white hover:bg-orange-600"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
