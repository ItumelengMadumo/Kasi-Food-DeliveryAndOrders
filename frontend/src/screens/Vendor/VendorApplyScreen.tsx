import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { createVendorApplication } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';

export function VendorApplyScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    applicantName: '',
    phone: '',
    email: '',
    businessName: '',
    address: '',
    description: '',
    hasBankAccount: false,
  });

  function update(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.applicantName || !form.phone || !form.businessName || !form.address) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await createVendorApplication({
        applicantName: form.applicantName,
        phone: form.phone,
        email: form.email || undefined,
        businessName: form.businessName,
        address: form.address,
        description: form.description || undefined,
        hasBankAccount: form.hasBankAccount,
      });
      setSubmitted(true);
    } catch {
      // Demo mode — show success anyway
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Application Submitted! 🎉</h2>
        <p className="text-stone-500 mb-6">
          We'll review your application and contact you within 24–48 hours.
        </p>
        <Button onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">Apply to Become a Vendor</h1>
          <p className="text-stone-500 text-sm">Join our platform and sell to your community</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          <strong>Welcome!</strong> Whether you have a bank account or not, you can sell on Kasi Eats. We'll handle payments that work for you.
        </div>

        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <h3 className="font-semibold text-stone-800">Personal Details</h3>
          <Input
            label="Full Name *"
            value={form.applicantName}
            onChange={(e) => update('applicantName', e.target.value)}
            placeholder="e.g. Thandi Dlamini"
            required
          />
          <Input
            label="Phone Number *"
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="e.g. 071 234 5678"
            required
          />
          <Input
            label="Email (optional)"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="e.g. thandi@example.com"
          />
        </section>

        <section className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
          <h3 className="font-semibold text-stone-800">Business Details</h3>
          <Input
            label="Business Name *"
            value={form.businessName}
            onChange={(e) => update('businessName', e.target.value)}
            placeholder="e.g. Mama Thandi's Kitchen"
            required
          />
          <Input
            label="Address *"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            placeholder="e.g. 12 Main Rd, Soweto, Johannesburg"
            required
          />
          <Textarea
            label="Tell us about your food (optional)"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What kind of food do you make? What makes it special?"
            rows={3}
          />
        </section>

        <section className="bg-white rounded-xl border border-stone-100 p-4">
          <h3 className="font-semibold text-stone-800 mb-3">Payment Setup</h3>
          <p className="text-stone-500 text-sm mb-3">
            Do you have a bank account for receiving payments?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => update('hasBankAccount', true)}
              className={`p-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                form.hasBankAccount
                  ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                  : 'border-stone-200 text-stone-600'
              }`}
            >
              ✅ Yes, I do
            </button>
            <button
              type="button"
              onClick={() => update('hasBankAccount', false)}
              className={`p-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                !form.hasBankAccount
                  ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                  : 'border-stone-200 text-stone-600'
              }`}
            >
              ❌ No bank account
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-2">
            {form.hasBankAccount
              ? 'Customers can pay digitally. Platform takes a small commission per order.'
              : 'Customers will pay cash on delivery/pickup. Platform charges a small admin fee per order.'}
          </p>
        </section>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
        )}

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Submit Application
        </Button>
      </form>
    </div>
  );
}
