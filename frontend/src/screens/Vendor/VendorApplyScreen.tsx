import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, LocateFixed } from 'lucide-react';
import { createVendorApplication } from '../../services/api';
import { getCurrentPosition, type Coordinates } from '../../domain/distance';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { PopiaNotice } from '../../components/PopiaNotice';

export function VendorApplyScreen() {
  const [applicantName, setApplicantName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [description, setDescription] = useState('');
  const [hasBankAccount, setHasBankAccount] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!applicantName.trim() || !phone.trim() || !businessName.trim() || !address.trim()) {
      setError('Your name, phone, business name, and address are required.');
      return;
    }

    if (!consented) {
      setError('Please confirm you agree to the Privacy Notice.');
      return;
    }

    setSubmitting(true);
    try {
      await createVendorApplication({
        applicantName: applicantName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        businessName: businessName.trim(),
        address: address.trim(),
        description: description.trim() || undefined,
        hasBankAccount,
        whatsappNumber: whatsappNumber.trim() || undefined,
        location: location || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit vendor application:', err);
      setError(
        err instanceof Error ? err.message : 'Could not submit your application. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center md:px-6">
        <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
        <h1 className="text-2xl font-black text-stone-950">Application received</h1>
        <p className="mt-2 text-stone-600">
          We'll review your details and reach out on WhatsApp or by phone to get your spot live.
        </p>
        <Link to="/" className="mt-6 inline-block">
          <Button variant="secondary">Back to home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 md:px-6">
      <h1 className="text-2xl font-black text-stone-950">Register your spot</h1>
      <p className="mt-2 text-stone-600">
        Tell us about your business. We'll review it and be in touch to get you live on Kasi Eats.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          label="Your name"
          value={applicantName}
          onChange={(e) => setApplicantName(e.target.value)}
          required
        />
        <Input
          label="Your phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <Input
          label="Email (optional)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Business / spot name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
        />
        <Input
          label="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />

        <div>
          <Button type="button" variant="secondary" onClick={handleUseLocation} disabled={locating}>
            <LocateFixed size={16} className="mr-2 inline" />
            {locating ? 'Locating…' : location ? 'Location set' : 'Use my location'}
          </Button>
          {locationError && <p className="mt-1 text-sm text-red-600">{locationError}</p>}
        </div>

        <Input
          label="WhatsApp number (optional)"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
        />
        <Textarea
          label="Tell us about your food (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={hasBankAccount}
            onChange={(e) => setHasBankAccount(e.target.checked)}
          />
          I have a business bank account
        </label>

        <PopiaNotice checked={consented} onChange={setConsented} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Submitting…' : 'Submit application'}
        </Button>
      </form>
    </div>
  );
}
