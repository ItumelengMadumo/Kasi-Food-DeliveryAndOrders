import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, LocateFixed, Plus, Trash2 } from 'lucide-react';
import { createVendorApplication, approveVendor, createMenuItem } from '../../services/api';
import { getCurrentPosition, type Coordinates } from '../../domain/distance';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';

interface DraftMenuItem {
  name: string;
  price: string;
  category: string;
}

const EMPTY_ITEM: DraftMenuItem = { name: '', price: '', category: '' };

export function AdminAddVendorScreen() {
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [description, setDescription] = useState('');
  const [hasBankAccount, setHasBankAccount] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [menuItems, setMenuItems] = useState<DraftMenuItem[]>([{ ...EMPTY_ITEM }]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ vendorId: string; whatsappNumber: string } | null>(null);

  async function handleUseLocation() {
    setLocating(true);
    setLocationError('');
    const pos = await getCurrentPosition();
    if (pos) {
      setLocation(pos);
    } else {
      setLocationError("Couldn't get your location — check that location access is allowed.");
    }
    setLocating(false);
  }

  function updateMenuItem(index: number, field: keyof DraftMenuItem, value: string) {
    setMenuItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addMenuItemRow() {
    setMenuItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeMenuItemRow(index: number) {
    setMenuItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!businessName.trim() || !address.trim() || !contactPhone.trim()) {
      setError('Business name, address, and contact phone are required.');
      return;
    }

    const validItems = menuItems.filter((item) => item.name.trim() && item.price.trim());
    for (const item of validItems) {
      if (Number.isNaN(Number(item.price)) || Number(item.price) <= 0) {
        setError(`"${item.name}" needs a valid price.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const application = await createVendorApplication({
        applicantName: businessName.trim(),
        phone: contactPhone.trim(),
        businessName: businessName.trim(),
        address: address.trim(),
        description: description.trim() || undefined,
        hasBankAccount,
        whatsappNumber: whatsappNumber.trim() || undefined,
        location: location || undefined,
      });

      const vendor = await approveVendor(application.id);

      for (const item of validItems) {
        await createMenuItem({
          vendorId: vendor.id,
          name: item.name.trim(),
          price: Number(item.price),
          category: item.category.trim() || undefined,
        });
      }

      setResult({ vendorId: vendor.id, whatsappNumber: vendor.whatsappNumber || '' });
    } catch (err) {
      console.error('Failed to onboard vendor:', err);
      setError(
        err instanceof Error ? err.message : 'Could not create this vendor. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Vendor added! 🎉</h2>
        <p className="text-stone-500 mb-2">
          {result.whatsappNumber
            ? `Customers can now message ${result.whatsappNumber} on WhatsApp to order.`
            : 'The vendor is live — add a WhatsApp number in their settings so customers can message them.'}
        </p>
        <div className="space-y-3 mt-8">
          <Button className="w-full" onClick={() => navigate(`/vendor/${result.vendorId}`)}>
            View Public Page
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate(`/vendor/dashboard?vendorId=${result.vendorId}`)}
          >
            Manage This Vendor
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setResult(null);
              setBusinessName('');
              setAddress('');
              setContactPhone('');
              setWhatsappNumber('');
              setDescription('');
              setHasBankAccount(false);
              setLocation(null);
              setMenuItems([{ ...EMPTY_ITEM }]);
            }}
          >
            Add Another Vendor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin')} className="p-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">Add Vendor</h1>
          <p className="text-stone-500 text-sm">
            Onboard a food spot on the spot — business details, menu, done.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <h2 className="font-semibold text-stone-800">Business Details</h2>
          <Input
            label="Business name *"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Mama Thandi's Kitchen"
            required
          />
          <Input
            label="Address *"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 12 Vilakazi St, Soweto"
            required
          />
          <Input
            label="Contact phone *"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+27 72 000 0000"
            required
          />
          <Input
            label="WhatsApp number"
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="+27721234567"
            hint="Customers will message this number to order. Include country code."
          />
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What do they sell?"
            rows={2}
          />
          <button
            type="button"
            onClick={() => setHasBankAccount((v) => !v)}
            className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
              hasBankAccount
                ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                : 'border-stone-200 text-stone-600'
            }`}
          >
            <span>Has a bank account</span>
            <span>{hasBankAccount ? 'Yes' : 'No — cash/EFT only'}</span>
          </button>
        </section>

        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <h2 className="font-semibold text-stone-800">Location</h2>
          <p className="text-xs text-stone-500">
            Stand at the food spot and tap below — this is what lets customers find them by
            distance.
          </p>
          <Button type="button" variant="secondary" onClick={handleUseLocation} loading={locating}>
            <LocateFixed size={16} className="mr-2" />
            {location ? 'Location captured ✓' : 'Use My Location'}
          </Button>
          {locationError && <p className="text-xs text-red-600">{locationError}</p>}
        </section>

        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <h2 className="font-semibold text-stone-800">Menu Items</h2>
          <p className="text-xs text-stone-500">Add as many as you can now — more can be added later.</p>
          <div className="space-y-3">
            {menuItems.map((item, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Input
                    value={item.name}
                    onChange={(e) => updateMenuItem(index, 'name', e.target.value)}
                    placeholder="Item name"
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => updateMenuItem(index, 'price', e.target.value)}
                    placeholder="Price"
                  />
                </div>
                <div className="w-28">
                  <Input
                    value={item.category}
                    onChange={(e) => updateMenuItem(index, 'category', e.target.value)}
                    placeholder="Category"
                  />
                </div>
                {menuItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMenuItemRow(index)}
                    className="p-2 mt-1 text-stone-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addMenuItemRow}>
            <Plus size={14} className="mr-1.5" />
            Add another item
          </Button>
        </section>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Add Vendor & Menu
        </Button>
      </form>
    </div>
  );
}
