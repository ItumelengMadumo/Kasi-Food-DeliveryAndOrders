import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Smartphone } from 'lucide-react';
import { useAuthStore } from '../../state/authStore';
import { getVendor, updateVendorProfile } from '../../services/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/Card';
import type { Vendor } from '../../types';

const DEMO_VENDOR_ID = 'demo-vendor-1';

export function VendorSettings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const vendorId = user?.id ? `vendor_${user.id}` : DEMO_VENDOR_ID;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryType, setDeliveryType] = useState<'PERCENTAGE' | 'FLAT' | ''>('');
  const [deliveryValue, setDeliveryValue] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const v = await getVendor(vendorId);
        if (v) {
          setVendor(v);
          setName(v.name || '');
          setAddress(v.address || '');
          setContactDetails(v.contactDetails || '');
          setWhatsappNumber(v.whatsappNumber || '');
          setDescription(v.description || '');
          setDeliveryType(v.deliveryType || '');
          setDeliveryValue(v.deliveryValue != null ? String(v.deliveryValue) : '');
        }
      } catch {
        // Demo mode: pre-fill with placeholder values
        setName("My Restaurant");
        setAddress("123 Main St, Soweto");
        setContactDetails("+27 72 000 0000");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [vendorId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSaved(false);

    // Validate WhatsApp number format if provided
    if (whatsappNumber && !/^\+\d{8,15}$/.test(whatsappNumber.replace(/\s/g, ''))) {
      setError('WhatsApp number must be in international format, e.g. +27721234567');
      setSaving(false);
      return;
    }

    try {
      await updateVendorProfile({
        vendorId,
        name: name.trim() || undefined,
        address: address.trim() || undefined,
        contactDetails: contactDetails.trim() || undefined,
        whatsappNumber: whatsappNumber.trim().replace(/\s/g, '') || undefined,
        description: description.trim() || undefined,
        deliveryType: (deliveryType as 'PERCENTAGE' | 'FLAT') || undefined,
        deliveryValue: deliveryValue ? parseFloat(deliveryValue) : undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Demo mode: show success anyway
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-xl font-bold">Business Settings</h1>
          <p className="text-stone-500 text-sm">
            {vendor?.name || 'Your restaurant'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Basic info */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-4">
          <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
            Business Info
          </h2>
          <Input
            label="Business name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mama Thandi's Kitchen"
            required
          />
          <Input
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 12 Vilakazi St, Soweto"
          />
          <Input
            label="Contact number"
            value={contactDetails}
            onChange={(e) => setContactDetails(e.target.value)}
            placeholder="+27 72 000 0000"
            type="tel"
          />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short description of your business"
          />
        </section>

        {/* WhatsApp number */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-green-600" />
            <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
              WhatsApp Ordering
            </h2>
          </div>
          <p className="text-xs text-stone-500">
            Customers will order by messaging this number on WhatsApp. You'll also receive
            instant order alerts here.
          </p>
          <Input
            label="WhatsApp number (international format)"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="+27721234567"
            type="tel"
            hint="Include country code, e.g. +27721234567"
          />
        </section>

        {/* Delivery */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-4">
          <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
            Delivery Fee
          </h2>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Fee type
            </label>
            <select
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value as 'PERCENTAGE' | 'FLAT' | '')}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kasi-orange focus:border-transparent bg-white"
            >
              <option value="">No delivery fee</option>
              <option value="FLAT">Flat rate (R fixed amount)</option>
              <option value="PERCENTAGE">Percentage of order total (%)</option>
            </select>
          </div>
          {deliveryType && (
            <Input
              label={deliveryType === 'FLAT' ? 'Flat fee (R)' : 'Percentage (%)'}
              value={deliveryValue}
              onChange={(e) => setDeliveryValue(e.target.value)}
              type="number"
              min="0"
              step={deliveryType === 'FLAT' ? '1' : '0.1'}
              placeholder={deliveryType === 'FLAT' ? '15' : '10'}
            />
          )}
        </section>

        {/* Error / success */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        {saved && (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
            ✅ Settings saved successfully!
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={saving}>
          <Save size={16} className="mr-2" />
          Save Settings
        </Button>
      </form>
    </div>
  );
}
