import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowLeft, MapPin, LocateFixed } from 'lucide-react';
import { getAllVendors } from '../../services/api';
import { VendorCard } from '../../components/VendorCard';
import { LoadingSpinner, EmptyState } from '../../components/ui/Card';
import { getCurrentPosition, distanceKm, type Coordinates } from '../../domain/distance';
import type { Vendor } from '../../types';

export function VendorDirectoryScreen() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [data, position] = await Promise.all([
          getAllVendors('APPROVED'),
          getCurrentPosition(),
        ]);
        if (cancelled) return;
        setVendors(data);
        if (position) {
          setUserLocation(position);
        } else {
          setLocationDenied(true);
        }
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

  const sortedVendors = userLocation
    ? [...vendors].sort((a, b) => {
        const da = a.location ? distanceKm(userLocation, a.location) : Infinity;
        const db = b.location ? distanceKm(userLocation, b.location) : Infinity;
        return da - db;
      })
    : vendors;

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">Food near you</h1>
          <p className="text-stone-500 text-sm">Browse local vendors and order for pickup or delivery.</p>
        </div>
      </div>

      {!loading && (
        <div className="mb-4 flex items-center gap-2 text-xs text-stone-500 pl-11">
          {userLocation ? (
            <>
              <LocateFixed size={14} className="text-kasi-orange" />
              Sorted by distance from your location
            </>
          ) : locationDenied ? (
            <>
              <MapPin size={14} />
              Turn on location to see what's closest to you
            </>
          ) : null}
        </div>
      )}

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
          {sortedVendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              distanceKm={
                userLocation && vendor.location ? distanceKm(userLocation, vendor.location) : undefined
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
