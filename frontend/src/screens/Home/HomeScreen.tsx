import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  CreditCard,
  MessageCircle,
  Search,
  Store,
  TrendingUp,
  Truck,
  Utensils,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { RequestSpotForm } from '../../components/RequestSpotForm';
import { VendorCard } from '../../components/VendorCard';
import { VendorMap } from '../../components/VendorMap';
import { LoadingSpinner } from '../../components/ui/Card';
import { getAllVendors, getNearbyVendors } from '../../services/api';
import { getCurrentPosition, distanceKm, type Coordinates } from '../../domain/distance';
import type { Vendor } from '../../types';

type HowItWorksTab = 'hungry' | 'sell';

export function HomeScreen() {
  const navigate = useNavigate();
  const [areaText, setAreaText] = useState('');
  const [tab, setTab] = useState<HowItWorksTab>('hungry');
  const [nearby, setNearby] = useState<Vendor[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [vendorCount, setVendorCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const all = await getAllVendors('APPROVED');
        if (cancelled) return;
        setVendorCount(all.length);

        const position = await getCurrentPosition();
        if (cancelled) return;
        if (position) {
          setUserLocation(position);
          const near = await getNearbyVendors(position.lat, position.lng, 15);
          if (cancelled) return;
          // Most vendors don't have a saved map pin yet, so this can come
          // back empty even with approved vendors — fall back to showing
          // some rather than a dead "no spots" card.
          setNearby(near.length > 0 ? near.slice(0, 6) : all.slice(0, 6));
        } else {
          setNearby(all.slice(0, 6));
        }
      } catch (err) {
        console.error('Failed to load homepage vendors:', err);
      } finally {
        if (!cancelled) setNearbyLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSeeFoodNearMe() {
    navigate('/vendors');
  }

  const distanceFor = (vendor: Vendor): number | undefined =>
    userLocation && vendor.location ? distanceKm(userLocation, vendor.location) : undefined;

  return (
    <main className="overflow-hidden pb-24 md:pb-0">
      {/* ── Hero (customers first) ──────────────────── */}
      <section className="relative isolate border-b border-stone-200 bg-stone-950 text-stone-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.35),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(251,191,36,0.2),_transparent_24%),linear-gradient(135deg,_#0c0a09_0%,_#1c1917_55%,_#292524_100%)]" />
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center md:px-6 md:py-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200">
            <BadgeCheck size={14} />
            Local kota spots, braai stands and kitchens
          </div>

          <h1 className="mt-6 text-4xl font-black leading-tight text-white md:text-6xl">
            Kasi food, delivered to your door.
          </h1>

          <p className="mt-5 text-base leading-7 text-stone-300 md:text-lg">
            Order from the food spots in your area. We pick it up and bring it to you.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSeeFoodNearMe();
            }}
            className="mx-auto mt-8 flex max-w-xl flex-col gap-2 rounded-2xl bg-white/95 p-2 shadow-xl sm:flex-row"
          >
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={areaText}
                onChange={(e) => setAreaText(e.target.value)}
                placeholder="Type your area or section"
                className="w-full rounded-xl py-2.5 pl-9 pr-3 text-stone-900 focus:outline-none"
              />
            </div>
            <Button type="submit" size="lg" className="rounded-xl">
              See food near me
              <ArrowRight size={18} className="ml-2" />
            </Button>
          </form>

          <Link
            to="/vendor/apply"
            className="mt-4 inline-block text-sm font-semibold text-orange-300 hover:text-orange-200"
          >
            Sell food? Get your spot on Kasi Eats →
          </Link>
        </div>
      </section>

      {/* ── Food near you (map + list) ──────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-kasi-orange">
              Food near you
            </p>
            <h2 className="mt-2 text-2xl font-black text-stone-950 md:text-3xl">
              Spots ready to take your order
            </h2>
          </div>
          <Link to="/vendors" className="text-sm font-semibold text-kasi-orange hover:underline">
            See all →
          </Link>
        </div>

        <div className="mt-6">
          {nearbyLoading ? (
            <LoadingSpinner className="py-12" />
          ) : (
            <>
              <VendorMap vendors={nearby} userLocation={userLocation} distanceFor={distanceFor} />
              {nearby.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center text-stone-500">
                  No spots near you yet. Tell us your favourite and we'll bring them on.
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {nearby.map((vendor) => (
                    <VendorCard key={vendor.id} vendor={vendor} distanceKm={distanceFor(vendor)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <RequestSpotForm className="mx-auto mt-10 max-w-md rounded-xl border border-stone-200 bg-white p-4" />
      </section>

      {/* ── How it works ─────────────────────────────── */}
      <section className="border-y border-stone-200 bg-stone-100/70">
        <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
          <h2 className="text-center text-2xl font-black text-stone-950 md:text-3xl">
            How it works
          </h2>

          <div className="mt-6 flex justify-center gap-2">
            {HOW_IT_WORKS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={clsx(
                  'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                  tab === t.key
                    ? 'border-kasi-orange bg-kasi-orange text-white'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-kasi-orange/50'
                )}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS_TABS.find((t) => t.key === tab)?.steps.map((step, i) => (
              <div key={step} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 font-bold text-kasi-orange">
                  {i + 1}
                </div>
                <p className="mt-3 text-sm font-semibold text-stone-800">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For vendors ──────────────────────────────── */}
      <section id="about" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-14 md:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-kasi-orange">
            For vendors
          </p>
          <h2 className="mt-3 text-3xl font-black text-stone-950 md:text-4xl">
            Your kitchen, on every phone in the area
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <article
              key={benefit.title}
              className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm shadow-stone-200/60"
            >
              <div className="inline-flex rounded-2xl bg-orange-50 p-3 text-kasi-orange">
                <benefit.icon size={22} />
              </div>
              <h3 className="mt-4 text-xl font-bold text-stone-950">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-stone-100/70">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-kasi-orange">
              What you get
            </p>
            <h2 className="mt-3 text-3xl font-black text-stone-950">
              A platform that matches the way local food businesses actually work
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
              Whether you run from home, a shared kitchen, or a busy street-side setup,
              the platform helps you handle orders clearly and keep customers updated.
            </p>
          </div>

          <div className="space-y-4">
            {PLATFORM_FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm">
                <div className="text-lg font-bold text-stone-950">{feature.title}</div>
                <p className="mt-2 text-sm leading-6 text-stone-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-14 md:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-kasi-orange">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-black text-stone-950 md:text-4xl">
            Clear pricing for vendors at different stages of growth
          </h2>
          <p className="mt-4 text-base leading-7 text-stone-600">
            Whether you are just starting or already handling regular orders, the platform is designed to keep costs understandable and support the way you trade.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PRICING_CARDS.map((card) => (
            <article
              key={card.title}
              className={clsx(
                'rounded-[28px] border p-6 shadow-sm',
                card.featured
                  ? 'border-kasi-orange bg-orange-50 shadow-orange-100'
                  : 'border-stone-200 bg-white shadow-stone-200/60'
              )}
            >
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-kasi-orange">
                {card.eyebrow}
              </div>
              <h3 className="mt-3 text-2xl font-black text-stone-950">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{card.description}</p>
              <div className="mt-6 text-3xl font-black text-stone-950">{card.price}</div>
              <div className="mt-1 text-sm text-stone-500">{card.priceNote}</div>
              <ul className="mt-6 space-y-2 text-sm text-stone-700">
                {card.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="text-kasi-orange">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────── */}
      <section className="border-t border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 text-center md:grid-cols-4 md:px-6">
          <div>
            <div className="text-2xl font-black text-stone-950">
              {vendorCount !== null ? vendorCount : '—'}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">Live vendors</div>
          </div>
          <div>
            <div className="text-2xl font-black text-stone-950">Soweto & nearby</div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">Areas covered</div>
          </div>
          <div>
            <div className="text-2xl font-black text-stone-950">08:00–20:00</div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">Delivery hours</div>
          </div>
          <div>
            <div className="text-2xl font-black text-stone-950">{CONTACT_OPTIONS[1].value}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-500">Support WhatsApp</div>
          </div>
        </div>
      </section>

      <section id="contact" className="border-t border-stone-200 bg-stone-950 text-stone-50 scroll-mt-28">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.1fr_0.9fr] md:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-orange-300">
              Contact Us
            </p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">
              Get support with onboarding, pricing, or vendor account setup
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">
              Reach out if you need help setting up your profile, getting your menu live, or understanding platform support and payment flows.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-1">
            {CONTACT_OPTIONS.map((option) => (
              <div key={option.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-200">
                  {option.title}
                </div>
                <div className="mt-2 text-lg font-bold text-white">{option.value}</div>
                <p className="mt-2 text-sm text-stone-300">{option.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="rounded-[32px] bg-kasi-orange px-6 py-10 text-white shadow-xl shadow-orange-200 md:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-orange-100">
              Ready to start
            </p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">
              Join the platform, list your business, and start taking orders.
            </h2>
            <p className="mt-4 text-base leading-7 text-orange-50/90">
              New vendors can apply in minutes. Returning vendors can sign in and manage
              menus, incoming orders, and settings from one place.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/vendors">
              <Button
                variant="secondary"
                size="lg"
                className="w-full rounded-full bg-white px-7 text-kasi-orange hover:bg-orange-50 sm:w-auto"
              >
                Browse Food
              </Button>
            </Link>
            <Link to="/auth?mode=register&role=vendor">
              <Button
                variant="ghost"
                size="lg"
                className="w-full rounded-full border border-white/40 px-7 text-white hover:bg-white/10 sm:w-auto"
              >
                Register as Vendor
              </Button>
            </Link>
            <Link to="/auth?mode=login&role=vendor">
              <Button
                variant="ghost"
                size="lg"
                className="w-full rounded-full border border-white/40 px-7 text-white hover:bg-white/10 sm:w-auto"
              >
                Login
              </Button>
            </Link>
            <Link to="/vendor/apply" className="inline-flex">
              <Button
                variant="ghost"
                size="lg"
                className="w-full rounded-full border border-white/20 px-7 text-white hover:bg-white/10 sm:w-auto"
              >
                Apply as Vendor
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="border-t border-stone-200 bg-stone-50 px-4 py-10 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-stone-500">
          <a href="#about" className="hover:text-kasi-orange">About</a>
          <a href="#contact" className="hover:text-kasi-orange">Contact</a>
          <Link to="/auth?mode=login&role=vendor" className="hover:text-kasi-orange">Vendor login</Link>
          <span className="cursor-default text-stone-400" title="Not published yet">
            Terms (coming soon)
          </span>
          <span className="cursor-default text-stone-400" title="Not published yet">
            Privacy / POPIA (coming soon)
          </span>
        </div>
      </footer>
    </main>
  );
}

const HOW_IT_WORKS_TABS: {
  key: HowItWorksTab;
  label: string;
  icon: typeof Utensils;
  steps: string[];
}[] = [
  {
    key: 'hungry',
    label: "I'm hungry",
    icon: Utensils,
    steps: ['Find a spot near you', 'Order on the site or WhatsApp', 'We deliver, or you collect'],
  },
  {
    key: 'sell',
    label: 'I sell food',
    icon: Store,
    steps: ['Register free', 'Put your menu up', 'Get orders and new customers — we handle delivery'],
  },
];

const BENEFITS = [
  {
    title: 'Get found on the map',
    description: 'Put your business in front of nearby customers who are already looking for food options.',
    icon: TrendingUp,
  },
  {
    title: 'Take orders on WhatsApp and online',
    description: 'View new orders, update status, and manage your menu without juggling multiple tools.',
    icon: Store,
  },
  {
    title: 'We deliver, you cook',
    description: 'Support cash on delivery, cash on pickup, and digital flows depending on how you operate.',
    icon: Truck,
  },
  {
    title: 'WhatsApp-Friendly Workflows',
    description: 'Stay connected to customers with communication patterns that already fit township commerce.',
    icon: MessageCircle,
  },
];

const PLATFORM_FEATURES = [
  {
    title: 'Menu and availability controls',
    description: 'Update pricing, switch items on or off, and keep your listing accurate during the day.',
  },
  {
    title: 'Pickup and delivery support',
    description: 'Choose the fulfillment model that fits your kitchen, staff capacity, and customer area.',
  },
  {
    title: 'Vendor settings that match real operations',
    description: 'Set contact details, WhatsApp number, delivery fees, hours, and business information from one place.',
  },
  {
    title: 'Built for growth, not only setup',
    description: 'The platform is designed to help small food businesses get discovered and scale repeat ordering.',
  },
];

const PRICING_CARDS = [
  {
    eyebrow: 'Starter',
    title: 'Apply and Launch',
    description: 'Best for new vendors getting their business visible and ready to receive orders.',
    price: 'R0/mo',
    priceNote: 'Free to apply. Start with onboarding and vendor approval.',
    points: [
      'Business profile and vendor onboarding',
      'Menu listing and availability controls',
      'Dashboard access for incoming orders',
    ],
    featured: false,
  },
  {
    eyebrow: 'Core Plan',
    title: 'Commission-Based',
    description: 'Designed for vendors using the platform to manage regular orders and visibility.',
    price: '10% per order (indicative)',
    priceNote: 'A commission applies per order — final rate TBC.',
    points: [
      'Order tracking and vendor dashboard analytics',
      'Customer-ready menu and pricing management',
      'Settings for contact, delivery, and support details',
    ],
    featured: true,
  },
  {
    eyebrow: 'Flexible',
    title: 'Cash-Friendly Support',
    description: 'Built for businesses that still rely on delivery cash flow or pickup-first operations.',
    price: 'R5 per order (indicative)',
    priceNote: 'A flat admin fee instead of commission, for vendors without a linked bank account — useful when digital payout flows are not yet fully set up.',
    points: [
      'Cash on delivery or pickup support',
      'Operational flexibility while growing',
      'Works alongside contact and WhatsApp-driven order handling',
    ],
    featured: false,
  },
];

const CONTACT_OPTIONS = [
  {
    title: 'Email Support',
    value: 'support@kasieats.co.za',
    description: 'Reach out for platform questions, setup help, or vendor onboarding support.',
  },
  {
    // TODO: swap for the real support/WhatsApp Business number before pilot launch.
    title: 'WhatsApp',
    value: '+27 72 000 0000',
    description: 'Use WhatsApp support for quick help with vendor account setup and guidance.',
  },
  {
    title: 'Support Hours',
    value: 'Mon to Sat, 08:00 - 18:00',
    description: 'General support availability for vendor operations and onboarding issues.',
  },
];
