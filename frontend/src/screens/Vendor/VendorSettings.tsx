import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Smartphone, MapPin } from 'lucide-react';
import { useAuthStore } from '../../state/authStore';
import {
  getVendor,
  getVendorBankDetails,
  updateVendorBankDetails,
  updateVendorProfile,
} from '../../services/api';
import { getCurrentPosition } from '../../domain/distance';
import { WEEKDAYS, WEEKDAY_LABELS } from '../../domain/hours';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { PopiaNotice } from '../../components/PopiaNotice';
import { LoadingSpinner } from '../../components/ui/Card';
import type { Vendor, WorkingHours } from '../../types';

const CATEGORY_OPTIONS = ['Kota', 'Braai', 'Mogodu', 'Plates', 'Bakery', 'Drinks'];

const DEFAULT_HOURS: WorkingHours = {
  monday: '09:00-18:00',
  tuesday: '09:00-18:00',
  wednesday: '09:00-18:00',
  thursday: '09:00-18:00',
  friday: '09:00-18:00',
  saturday: '09:00-18:00',
  sunday: 'closed',
};

export function VendorSettings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const overrideVendorId = searchParams.get('vendorId');
  // Admins can manage any vendor's settings by linking with ?vendorId=... —
  // vendors onboarded by the operator have no Cognito login of their own.
  const vendorId = (user?.role === 'ADMIN' && overrideVendorId) || user?.id;
  const backHref = overrideVendorId
    ? `/vendor/dashboard?vendorId=${overrideVendorId}`
    : '/vendor/dashboard';

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Form state — Business info
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [description, setDescription] = useState('');

  // WhatsApp contact number (used by clients to reach the business)
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Digital payments (PayFast/Ozow) — off by default; most vendors collect
  // cash/EFT on pickup or delivery for now.
  const [digitalPaymentsEnabled, setDigitalPaymentsEnabled] = useState(false);

  // Delivery setup
  const [deliveryType, setDeliveryType] = useState<'FLAT' | 'PERCENTAGE'>('FLAT');
  const [deliveryValue, setDeliveryValue] = useState('');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState('');

  // Trading hours
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_HOURS);

  // Categories
  const [categories, setCategories] = useState<string[]>([]);

  // Banking details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [bankingConsented, setBankingConsented] = useState(false);

  useEffect(() => {
    if (!vendorId) return;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [v, bank] = await Promise.all([
          getVendor(vendorId!),
          getVendorBankDetails(vendorId!).catch(() => null),
        ]);
        if (v) {
          setVendor(v);
          setName(v.name || '');
          setAddress(v.address || '');
          setContactDetails(v.contactDetails || '');
          setWhatsappNumber(v.whatsappNumber || '');
          setDescription(v.description || '');
          setDigitalPaymentsEnabled(v.digitalPaymentsEnabled === true);
          setDeliveryType(v.deliveryType || 'FLAT');
          setDeliveryValue(v.deliveryValue != null ? String(v.deliveryValue) : '');
          setDeliveryRadiusKm(v.deliveryRadiusKm != null ? String(v.deliveryRadiusKm) : '');
          setLocation(v.location || null);
          setWorkingHours({ ...DEFAULT_HOURS, ...(v.workingHours || {}) });
          setCategories(v.categories || []);
        }
        setBankName(bank?.bankName || '');
        setAccountNumber(bank?.accountNumber || '');
        setAccountHolder(bank?.accountHolder || '');
        setBranchCode(bank?.branchCode || '');
      } catch (err) {
        console.error('Failed to load vendor settings:', err);
        setError('Could not load your business settings. Please refresh and try again.');
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

    if (!vendorId) {
      setError('You must be signed in as a vendor to save settings.');
      setSaving(false);
      return;
    }

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
        digitalPaymentsEnabled,
        deliveryType,
        deliveryValue: deliveryValue ? Number(deliveryValue) : undefined,
        deliveryRadiusKm: deliveryRadiusKm ? Number(deliveryRadiusKm) : undefined,
        location: location || undefined,
        workingHours,
        categories,
      });

      const bankPayload = {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        branchCode: branchCode.trim(),
      };

      if (Object.values(bankPayload).some(Boolean)) {
        if (!bankingConsented) {
          setError('Please agree to the Privacy Notice to save banking details.');
          setSaving(false);
          return;
        }
        await updateVendorBankDetails(vendorId, bankPayload);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save vendor settings:', err);
      setError(
        err instanceof Error ? err.message : 'Could not save your settings. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUseMyLocation() {
    setLocating(true);
    setLocationMsg('');
    const coords = await getCurrentPosition();
    if (coords) {
      setLocation(coords);
      setLocationMsg(`Pin saved: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    } else {
      setLocationMsg('Could not get your location — check location permissions and try again.');
    }
    setLocating(false);
  }

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function setDayHours(day: keyof WorkingHours, value: string) {
    setWorkingHours((prev) => ({ ...prev, [day]: value }));
  }

  if (loading) {
    return <LoadingSpinner className="py-16" />;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(backHref)}
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
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-2">
          <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
            Module Detail
          </h2>
          <p className="text-sm text-stone-600">
            This page manages your business identity and payout setup. Keep these fields accurate
            so customer communication, WhatsApp routing, and payment operations stay aligned.
          </p>
          <div className="grid gap-2 text-xs text-stone-500 sm:grid-cols-3">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <span className="font-semibold text-stone-700">Business Info</span>
              <p className="mt-1">Shown across your profile and customer touchpoints.</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <span className="font-semibold text-stone-700">WhatsApp Number</span>
              <p className="mt-1">Used for inbound order routing and customer contact.</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <span className="font-semibold text-stone-700">Banking Details</span>
              <p className="mt-1">Used by EFT workflows and future payout reconciliation.</p>
            </div>
          </div>
        </section>

        {/* Business Info */}
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

        {/* Location pin */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-kasi-orange" />
            <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
              Map Location
            </h2>
          </div>
          <p className="text-xs text-stone-500">
            Drop a pin at your business so customers can see your spot and distance on the map.
          </p>
          {location && (
            <p className="text-xs text-stone-600">
              Current pin: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleUseMyLocation}
            loading={locating}
          >
            <MapPin size={16} className="mr-2" />
            {location ? 'Re-drop pin at my location' : 'Use my location'}
          </Button>
          {locationMsg && <p className="text-xs text-stone-500">{locationMsg}</p>}
        </section>

        {/* Categories */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
            Categories
          </h2>
          <p className="text-xs text-stone-500">
            Helps customers filter for the kind of food you sell.
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  categories.includes(cat)
                    ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                    : 'border-stone-200 text-stone-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Trading hours */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
            Trading Hours
          </h2>
          <p className="text-xs text-stone-500">
            Set each day as "HH:MM-HH:MM" or mark it closed. Customers see an open/closed badge
            based on this.
          </p>
          <div className="space-y-2">
            {WEEKDAYS.map((day) => {
              const value = workingHours[day] || 'closed';
              const isClosed = value === 'closed';
              const [open, close] = isClosed ? ['09:00', '18:00'] : value.split('-');
              return (
                <div key={day} className="flex items-center gap-2">
                  <span className="w-24 text-sm text-stone-600">{WEEKDAY_LABELS[day]}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDayHours(day, isClosed ? `${open}-${close}` : 'closed')
                    }
                    className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                      isClosed
                        ? 'border-stone-200 text-stone-500'
                        : 'border-kasi-orange bg-orange-50 text-kasi-orange'
                    }`}
                  >
                    {isClosed ? 'Closed' : 'Open'}
                  </button>
                  {!isClosed && (
                    <>
                      <input
                        type="time"
                        value={open}
                        onChange={(e) => setDayHours(day, `${e.target.value}-${close}`)}
                        className="rounded-lg border border-stone-200 px-2 py-1 text-sm"
                      />
                      <span className="text-stone-400 text-sm">to</span>
                      <input
                        type="time"
                        value={close}
                        onChange={(e) => setDayHours(day, `${open}-${e.target.value}`)}
                        className="rounded-lg border border-stone-200 px-2 py-1 text-sm"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Delivery setup */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
            Delivery Setup
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeliveryType('FLAT')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                deliveryType === 'FLAT'
                  ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                  : 'border-stone-200 text-stone-600'
              }`}
            >
              Flat fee (R)
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType('PERCENTAGE')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                deliveryType === 'PERCENTAGE'
                  ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                  : 'border-stone-200 text-stone-600'
              }`}
            >
              % of order
            </button>
          </div>
          <Input
            label={deliveryType === 'FLAT' ? 'Delivery fee (R)' : 'Delivery fee (% of order)'}
            value={deliveryValue}
            onChange={(e) => setDeliveryValue(e.target.value)}
            placeholder={deliveryType === 'FLAT' ? '15' : '10'}
            type="number"
          />
          <Input
            label="Delivery radius (km)"
            value={deliveryRadiusKm}
            onChange={(e) => setDeliveryRadiusKm(e.target.value)}
            placeholder="5"
            type="number"
          />
        </section>

        {/* WhatsApp contact number */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-green-600" />
            <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
              WhatsApp Number
            </h2>
          </div>
          <p className="text-xs text-stone-500">
            The WhatsApp number clients will use to reach your business.
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

        {/* Digital payments opt-in */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
            Online Payment
          </h2>
          <p className="text-xs text-stone-500">
            Off by default — customers pay cash or EFT on pickup/delivery. Turn this on once
            you're ready to accept card payments online via PayFast or Ozow.
          </p>
          <button
            type="button"
            onClick={() => setDigitalPaymentsEnabled((v) => !v)}
            className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
              digitalPaymentsEnabled
                ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                : 'border-stone-200 text-stone-600'
            }`}
          >
            <span>Accept online card payments</span>
            <span>{digitalPaymentsEnabled ? 'On' : 'Off'}</span>
          </button>
        </section>

        {/* Banking Details */}
        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-4">
          <h2 className="font-semibold text-stone-800 text-sm uppercase tracking-wide">
            Banking Details
          </h2>
          <p className="text-xs text-stone-500">
            Add payout details so we can send your earnings to the right account.
          </p>
          <Input
            label="Bank Name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g. Capitec"
          />
          <Input
            label="Account Holder"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="Business or owner name"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="1234567890"
            />
            <Input
              label="Branch Code"
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
              placeholder="470010"
            />
          </div>
          <PopiaNotice
            checked={bankingConsented}
            onChange={setBankingConsented}
            detail="your banking details"
          />
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
