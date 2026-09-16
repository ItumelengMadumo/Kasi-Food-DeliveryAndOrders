import { Link } from 'react-router-dom';

/**
 * Consent checkbox gating a form that collects personal data (phone,
 * location, banking details). Label copy adapts to what's actually being
 * collected on the screen it's placed on.
 */
export function PopiaNotice({
  checked,
  onChange,
  detail = 'your phone number and location',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  detail?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-stone-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-stone-300 text-kasi-orange focus:ring-kasi-orange"
        required
      />
      <span>
        I agree to Kasi Eats collecting and using {detail} as described in the{' '}
        <Link to="/privacy" target="_blank" className="text-kasi-orange underline">
          Privacy Notice
        </Link>
        .
      </span>
    </label>
  );
}
