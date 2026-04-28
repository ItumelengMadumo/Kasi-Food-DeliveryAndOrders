import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  CreditCard,
  MessageCircle,
  Store,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function HomeScreen() {
  return (
    <main className="overflow-hidden pb-24 md:pb-0">
      <section className="relative isolate border-b border-stone-200 bg-stone-950 text-stone-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.35),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(251,191,36,0.2),_transparent_24%),linear-gradient(135deg,_#0c0a09_0%,_#1c1917_55%,_#292524_100%)]" />
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-14 md:grid-cols-[1.15fr_0.85fr] md:px-6 md:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200">
              <BadgeCheck size={14} />
              Built for township food businesses
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight text-white md:text-6xl">
              Turn your kitchen into a
              <span className="block text-orange-400">daily ordering business</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-300 md:text-lg">
              Kasi Eats helps local vendors take orders, manage delivery or pickup,
              get paid, and stay visible to nearby customers without needing a full
              storefront or complicated setup.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth?mode=register&role=vendor">
                <Button size="lg" className="w-full rounded-full px-7 sm:w-auto">
                  Register as a Vendor
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
              <Link to="/auth?mode=login&role=vendor">
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full rounded-full border border-white/20 bg-white/5 px-7 text-white hover:bg-white/10 sm:w-auto"
                >
                  Login to Your Shop
                </Button>
              </Link>
            </div>

            <div className="mt-8 grid gap-4 text-sm text-stone-300 sm:grid-cols-3">
              {HERO_STATS.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <div className="text-2xl font-black text-white">{stat.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.2em] text-stone-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full border border-orange-300/20 bg-orange-400/10 blur-2xl" />
            <div className="relative rounded-[28px] border border-white/10 bg-white/95 p-5 text-stone-900 shadow-2xl shadow-black/30">
              <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                <div>
                  <p className="text-sm font-semibold text-stone-500">Vendor Snapshot</p>
                  <h2 className="text-xl font-bold text-stone-950">Mama Thandi's Kitchen</h2>
                </div>
                <div className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Open for orders
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {DASHBOARD_CARDS.map((card) => (
                  <div key={card.title} className="rounded-2xl bg-stone-100 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-stone-600">
                      <card.icon size={16} className="text-kasi-orange" />
                      {card.title}
                    </div>
                    <div className="mt-2 text-2xl font-black text-stone-950">{card.value}</div>
                    <p className="mt-1 text-sm text-stone-500">{card.description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-stone-950 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Live order flow</p>
                    <h3 className="mt-1 text-lg font-bold">WhatsApp to dashboard</h3>
                  </div>
                  <MessageCircle size={20} className="text-orange-400" />
                </div>
                <div className="mt-4 space-y-3">
                  {LIVE_FLOW.map((step) => (
                    <div key={step.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-orange-400 font-bold text-stone-950">
                        {step.number}
                      </div>
                      <div>
                        <div className="font-semibold">{step.title}</div>
                        <div className="text-sm text-stone-300">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-14 md:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-kasi-orange">
            Why vendors join
          </p>
          <h2 className="mt-3 text-3xl font-black text-stone-950 md:text-4xl">
            Simple tools for selling more, responding faster, and staying organised
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
            <Link to="/auth?mode=register&role=vendor">
              <Button
                variant="secondary"
                size="lg"
                className="w-full rounded-full bg-white px-7 text-kasi-orange hover:bg-orange-50 sm:w-auto"
              >
                Register
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
    </main>
  );
}

const HERO_STATS = [
  { value: '1 place', label: 'To manage orders' },
  { value: '24/7', label: 'Business visibility' },
  { value: 'Fast', label: 'Vendor onboarding' },
];

const DASHBOARD_CARDS = [
  {
    title: 'Orders Today',
    value: '18',
    description: 'Track new, preparing, and completed orders in one flow.',
    icon: Store,
  },
  {
    title: 'Repeat Customers',
    value: '62%',
    description: 'Stay visible and easy to reorder from nearby communities.',
    icon: TrendingUp,
  },
  {
    title: 'Average Prep Time',
    value: '22m',
    description: 'Set expectations clearly for delivery and pickup orders.',
    icon: Clock3,
  },
  {
    title: 'Payment Options',
    value: '3',
    description: 'Cash, pickup, and digital-friendly ordering support.',
    icon: CreditCard,
  },
];

const LIVE_FLOW = [
  {
    number: '1',
    title: 'Customers discover your shop',
    description: 'Your menu, contact details, and delivery setup stay visible online.',
  },
  {
    number: '2',
    title: 'Orders reach you instantly',
    description: 'Incoming orders can be tracked through the dashboard and WhatsApp flow.',
  },
  {
    number: '3',
    title: 'You fulfill with less admin',
    description: 'Update order status, manage availability, and keep service moving.',
  },
];

const BENEFITS = [
  {
    title: 'More Local Reach',
    description: 'Put your business in front of nearby customers who are already looking for food options.',
    icon: TrendingUp,
  },
  {
    title: 'Simple Order Management',
    description: 'View new orders, update status, and manage your menu without juggling multiple tools.',
    icon: Store,
  },
  {
    title: 'Flexible Payment Support',
    description: 'Support cash on delivery, cash on pickup, and digital flows depending on how you operate.',
    icon: CreditCard,
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
    description: 'Set contact details, WhatsApp number, delivery fees, and business information from one place.',
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
    price: 'Apply Free',
    priceNote: 'Start with onboarding and vendor approval.',
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
    price: 'Per Order',
    priceNote: 'A platform fee applies as orders come in.',
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
    price: 'Admin Fee Model',
    priceNote: 'Useful when digital payout flows are not yet fully set up.',
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
