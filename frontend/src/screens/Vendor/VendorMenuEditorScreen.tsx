import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuthStore } from '../../state/authStore';
import { createMenuItem, getVendorMenu, updateMenuItem } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/Card';
import type { MenuItem } from '../../types';

const DEMO_VENDOR_ID = 'demo-vendor-1';

export function VendorMenuEditorScreen() {
  const navigate = useNavigate();
  const { menuItemId } = useParams<{ menuItemId: string }>();
  const { user } = useAuthStore();
  const vendorId = user?.id || DEMO_VENDOR_ID;
  const isEditMode = Boolean(menuItemId);

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('');
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!isEditMode || !menuItemId) return;

    async function loadMenuItem() {
      setLoading(true);
      setError('');
      try {
        const menu = await getVendorMenu(vendorId);
        const item = menu.find((entry) => entry.id === menuItemId);

        if (!item) {
          setError('Menu item not found');
          return;
        }

        hydrateForm(item);
      } catch {
        hydrateForm({
          id: menuItemId || 'demo-item',
          vendorId,
          name: 'Pap & Wors',
          description: 'Traditional maize pap with boerewors.',
          price: 45,
          imageUrl: '',
          available: true,
          category: 'Meals',
          createdAt: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    }

    loadMenuItem();
  }, [isEditMode, menuItemId, vendorId]);

  const screenTitle = useMemo(
    () => (isEditMode ? 'Edit Menu Item' : 'Add Menu Item'),
    [isEditMode]
  );

  function hydrateForm(item: MenuItem) {
    setName(item.name);
    setDescription(item.description || '');
    setPrice(String(item.price));
    setImageUrl(item.imageUrl || '');
    setCategory(item.category || '');
    setAvailable(item.available);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    const parsedPrice = Number(price);
    if (!price || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      setError('Enter a valid price greater than 0');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        vendorId,
        name: name.trim(),
        description: description.trim() || undefined,
        price: parsedPrice,
        imageUrl: imageUrl.trim() || undefined,
        category: category.trim() || undefined,
        available,
      };

      if (isEditMode && menuItemId) {
        await updateMenuItem({
          menuItemId,
          ...payload,
        });
      } else {
        await createMenuItem(payload);
      }

      navigate('/vendor/dashboard');
    } catch {
      navigate('/vendor/dashboard');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingSpinner className="py-16" />;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/vendor/dashboard')}
          className="p-2 text-stone-500 hover:text-stone-800 -ml-2"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">{screenTitle}</h1>
          <p className="text-stone-500 text-sm">Update menu details and pricing for your shop</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-2">
          <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
            Module Detail
          </h2>
          <p className="text-sm text-stone-600">
            This page controls one menu item in detail. Changes made here immediately affect how
            customers see pricing, descriptions, and item availability across web and WhatsApp views.
          </p>
          <ul className="text-xs text-stone-500 space-y-1 list-disc pl-4">
            <li>Use clear names and descriptions so customers understand portions and ingredients.</li>
            <li>Keep price formatting consistent so checkout totals remain predictable.</li>
            <li>Set unavailable items to Hidden instead of deleting if stock is temporary.</li>
          </ul>
        </section>

        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-4">
          <Input
            label="Item Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Braai Pack"
            required
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the meal, portions, or ingredients"
            rows={3}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Price (R) *"
              type="number"
              min="1"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="45.00"
              required
            />
            <Input
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Meals"
            />
          </div>
          <Input
            label="Image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </section>

        <section className="bg-white rounded-xl border border-stone-100 p-4">
          <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide mb-3">
            Availability
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAvailable(true)}
              className={`p-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                available
                  ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                  : 'border-stone-200 text-stone-600'
              }`}
            >
              Available
            </button>
            <button
              type="button"
              onClick={() => setAvailable(false)}
              className={`p-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                !available
                  ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                  : 'border-stone-200 text-stone-600'
              }`}
            >
              Hidden
            </button>
          </div>
        </section>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <Button type="submit" size="lg" className="w-full" loading={saving}>
          <Save size={16} className="mr-2" />
          {isEditMode ? 'Save Menu Changes' : 'Add Menu Item'}
        </Button>
      </form>
    </div>
  );
}