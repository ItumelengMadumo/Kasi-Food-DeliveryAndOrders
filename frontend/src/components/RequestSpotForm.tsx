import { useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { createSpotRequest } from '../services/api';
import { getCurrentPosition, type Coordinates } from '../domain/distance';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

const CATEGORY_OPTIONS = ['Kota', 'Braai', 'Mogodu', 'Plates', 'Bakery', 'Drinks', 'Other'];

interface RequestSpotFormProps {
  className?: string;
}

export function RequestSpotForm({ className }: RequestSpotFormProps) {
  const [name, setName] = useState('');
  const [areaText, setAreaText] = useState('');
  const [pin, setPin] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [category, setCategory] = useState('Kota');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleUseLocation() {
    setLocating(true);
    const pos = await getCurrentPosition();
    setLocating(false);
    if (pos) setPin(pos);
    else setError('Could not get your location — type the area name instead.');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Tell us the spot\'s name.');
      return;
    }
    if (!pin && !areaText.trim()) {
      setError('Drop a pin or tell us the area/section.');
      return;
    }
    if (!requesterPhone.trim()) {
      setError('We need your WhatsApp number to let you know when it\'s live.');
      return;
    }
    setSubmitting(true);
    try {
      await createSpotRequest({
        name: name.trim(),
        location: pin || undefined,
        areaText: areaText.trim() || undefined,
        category,
        ownerPhone: ownerPhone.trim() || undefined,
        requesterPhone: requesterPhone.trim(),
      });
      setDone(true);
    } catch (err) {
      console.error('Failed to submit spot request:', err);
      setError('Could not send your request right now. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={className}>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-stone-700">
          Thanks! We'll reach out to <strong>{name}</strong> and let you know on WhatsApp once they're on Kasi Eats.
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="font-bold text-stone-800 mb-1">Can't find your spot?</h3>
      <p className="text-sm text-stone-500 mb-3">
        Tell us who you'd like to see on Kasi Eats — every request helps us bring them on.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="Spot name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mama Thandi's Kitchen"
          required
        />
        <div>
          <Input
            label="Area or section"
            value={areaText}
            onChange={(e) => setAreaText(e.target.value)}
            placeholder="e.g. Diepkloof Zone 4"
          />
          <button
            type="button"
            onClick={handleUseLocation}
            disabled={locating}
            className="mt-1.5 flex items-center gap-1.5 text-sm text-kasi-orange font-medium disabled:opacity-50"
          >
            <LocateFixed size={14} />
            {locating ? 'Getting your location…' : pin ? 'Pin dropped ✓' : 'Or drop a pin at my location'}
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">What do they sell?</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-kasi-orange"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Owner's number (optional)"
          value={ownerPhone}
          onChange={(e) => setOwnerPhone(e.target.value)}
          placeholder="If you know it"
        />
        <Input
          label="Your WhatsApp number"
          value={requesterPhone}
          onChange={(e) => setRequesterPhone(e.target.value)}
          placeholder="So we can tell you when they're live"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={submitting} className="w-full">
          Request this spot
        </Button>
      </form>
    </div>
  );
}
