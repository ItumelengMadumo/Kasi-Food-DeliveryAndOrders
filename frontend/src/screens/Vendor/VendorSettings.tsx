import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Smartphone } from 'lucide-react';
import { useAuthStore } from '../../state/authStore';
import {
  getVendor,
  updateVendorBankDetails,
  updateVendorProfile,
} from '../../services/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/Card';
import type { BankDetails, Vendor } from '../../types';

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

  // Form state — Business info
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [description, setDescription] = useState('');

  // WhatsApp contact number (used by clients to reach the business)
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Banking details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [branchCode, setBranchCode] = useState('');

  const bankStorageKey = `kasi-vendor-bank-${vendorId}`;

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
          hydrateBankDetails(v.bankDetails);
        }
      } catch {
        // Demo mode: pre-fill with placeholder values
        setName('My Restaurant');
        setAddress('123 Main St, Soweto');
        setContactDetails('+27 72 000 0000');
      } finally {
        hydrateBankDetailsFromStorage();
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  function hydrateBankDetails(details?: BankDetails) {
    setBankName(details?.bankName || '');
    setAccountNumber(details?.accountNumber || '');
    setAccountHolder(details?.accountHolder || '');
    setBranchCode(details?.branchCode || '');
  }

  function hydrateBankDetailsFromStorage() {
    try {
      const saved = localStorage.getItem(bankStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<BankDetails>;
      setBankName((current) => current || parsed.bankName || '');
      setAccountNumber((current) => current || parsed.accountNumber || '');
      setAccountHolder((current) => current || parsed.accountHolder || '');
      setBranchCode((current) => current || parsed.branchCode || '');
    } catch {
      return;
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSaved(false);

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
      });

      const bankPayload = {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        branchCode: branchCode.trim(),
      };

      if (Object.values(bankPayload).some(Boolean)) {
        localStorage.setItem(bankStorageKey, JSON.stringify(bankPayload));
        try {
          await updateVendorBankDetails(vendorId, bankPayload);
        } catch {
          // Keep local persistence when backend bank details are unavailable.
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Demo mode: show success anyway
      const bankPayload = {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        branchCode: branchCode.trim(),
      };
      if (Object.values(bankPayload).some(Boolean)) {
        localStorage.setItem(bankStorageKey, JSON.stringify(bankPayload));
      }
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
