import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowLeft } from 'lucide-react';
import { getAllVendors } from '../../services/api';
import { VendorCard } from '../../components/VendorCard';
import { LoadingSpinner, EmptyState } from '../../components/ui/Card';
import type { Vendor } from '../../types';

export function VendorDirectoryScreen() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getAllVendors('APPROVED');
        if (!cancelled) setVendors(data);
      } catch (err) {
        console.error('Failed to load vendors:', err);
        if (!cancelled) setError('Could not load vendors right now. Please try again in a moment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">Food near you</h1>
          <p className="text-stone-500 text-sm">Browse local vendors and order for pickup or delivery.</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={<Store size={48} />}
          title="No vendors yet"
          description="Check back soon — new local food businesses are joining the platform."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      )}
    </main>
  );
}
