import { useState, useEffect } from 'react';
import { Search, MapPin } from 'lucide-react';
import { VendorCard } from '../../components/VendorCard';
import { LoadingSpinner, EmptyState } from '../../components/ui/Card';
import { getAllVendors } from '../../services/api';
import type { Vendor } from '../../types';

export function HomeScreen() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    setLoading(true);
    setError('');
    try {
      const data = await getAllVendors('APPROVED');
      setVendors(data);
    } catch (err) {
      console.error('Failed to load vendors:', err);
      setError('Failed to load vendors. Please try again.');
      // Show demo data in dev/offline mode
      setVendors(DEMO_VENDORS);
    } finally {
      setLoading(false);
    }
  }

  const filtered = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.address.toLowerCase().includes(search.toLowerCase()) ||
      v.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
      {/* Hero */}
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-stone-900">
          Fresh food from your <span className="text-kasi-orange">neighbourhood</span>
        </h1>
        <p className="mt-2 text-stone-500">
          Support local vendors. Order food made with love.
        </p>
      </section>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          placeholder="Search vendors, food, areas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-kasi-orange bg-white shadow-sm"
        />
      </div>

      {/* Location hint */}
      <div className="flex items-center gap-2 text-sm text-stone-500 mb-6">
        <MapPin size={14} className="text-kasi-orange" />
        <span>Showing vendors near you</span>
      </div>

      {/* Vendor grid */}
      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🍽️"
          title="No vendors found"
          description={search ? `No results for "${search}"` : 'No vendors available in your area yet.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-center text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
          {error} (Showing demo data)
        </p>
      )}
    </main>
  );
}

// Demo data for offline/dev mode
const DEMO_VENDORS: Vendor[] = [
  {
    id: 'demo-1',
    ownerId: 'owner-1',
    name: "Mama Thandi's Kitchen",
    address: 'Soweto, Johannesburg',
    status: 'APPROVED',
    hasBankAccount: false,
    description: 'Authentic home-cooked meals. Pap, chakalaka, braai, and more.',
    deliveryType: 'FLAT',
    deliveryValue: 15,
    rating: 4.8,
    totalReviews: 124,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    ownerId: 'owner-2',
    name: 'Kasi Burger Joint',
    address: 'Tembisa, Ekurhuleni',
    status: 'APPROVED',
    hasBankAccount: true,
    description: 'Juicy burgers, slap chips, and cold drinks.',
    deliveryType: 'PERCENTAGE',
    deliveryValue: 8,
    rating: 4.5,
    totalReviews: 87,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    ownerId: 'owner-3',
    name: 'Spicy Peri-Peri',
    address: 'Khayelitsha, Cape Town',
    status: 'APPROVED',
    hasBankAccount: true,
    description: 'Hot peri-peri chicken, Portuguese-inspired flavours.',
    deliveryType: 'FLAT',
    deliveryValue: 20,
    rating: 4.6,
    totalReviews: 63,
    createdAt: new Date().toISOString(),
  },
];
