import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Placeholder POPIA notice — plain-language draft only. Needs review by the
 * business owner or counsel before this is relied on as the real policy.
 */
export function PrivacyNoticeScreen() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-6">
        <ArrowLeft size={16} /> Back
      </Link>
      <h1 className="text-2xl font-bold text-stone-900 mb-2">Privacy Notice</h1>
      <p className="text-sm text-stone-400 mb-6">
        Draft — pending review. Contact the Kasi Eats team with any questions about your data.
      </p>

      <div className="prose prose-sm prose-stone max-w-none space-y-4 text-stone-700">
        <section>
          <h2 className="text-base font-semibold text-stone-900">What we collect</h2>
          <p>
            When you sign up, order, or register as a vendor, we collect your name, phone number,
            and (for vendors) business address, location, and banking details for payouts.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-stone-900">Why we collect it</h2>
          <p>
            To create your account, connect you with nearby vendors, process and deliver orders,
            and — for vendors — pay out amounts owed to you. We do not sell your information.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-stone-900">Who can see it</h2>
          <p>
            Your order details are shared with the vendor fulfilling your order. Vendor banking
            details are only visible to that vendor and platform administrators.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-stone-900">Your rights</h2>
          <p>
            Under South Africa's Protection of Personal Information Act (POPIA), you can ask to
            see, correct, or delete the personal information we hold about you at any time.
          </p>
        </section>
      </div>
    </div>
  );
}
