import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Smartphone } from 'lucide-react';
import { useAuthStore } from '../../state/authStore';
import {
  getVendor,
  getVendorBankDetails,
  updateVendorBankDetails,
  updateVendorProfile,
} from '../../services/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/Card';
import type { Vendor } from '../../types';

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

  // Banking details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [branchCode, setBranchCode] = useState('');

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
      });

      const bankPayload = {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        branchCode: branchCode.trim(),
      };

      if (Object.values(bankPayload).some(Boolean)) {
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
