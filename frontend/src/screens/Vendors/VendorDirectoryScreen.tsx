import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowLeft, MapPin, LocateFixed, List, Map as MapIcon, Search } from 'lucide-react';
import { getAllVendors, getNearbyVendors } from '../../services/api';
import { VendorCard } from '../../components/VendorCard';
import { VendorMap } from '../../components/VendorMap';
import { RequestSpotForm } from '../../components/RequestSpotForm';
import { LoadingSpinner, EmptyState } from '../../components/ui/Card';
import { getCurrentPosition, distanceKm, type Coordinates } from '../../domain/distance';
import { getOpenStatus } from '../../domain/hours';
import type { Vendor } from '../../types';

const CATEGORY_FILTERS = ['Kota', 'Braai', 'Mogodu', 'Plates', 'Bakery', 'Drinks'];
const NEARBY_RADIUS_KM = 15;

export function VendorDirectoryScreen() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('map');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const position = await getCurrentPosition();
        if (cancelled) return;

        if (position) {
          setUserLocation(position);
          const nearby = await getNearbyVendors(position.lat, position.lng, NEARBY_RADIUS_KM);
          if (cancelled) return;
          if (nearby.length > 0) {
            setVendors(nearby);
          } else {
            // Most vendors don't have a saved map pin yet, so the radius
            // filter above can legitimately come back empty even though
            // approved vendors exist — fall back to showing everyone rather
            // than a dead "no spots" screen. Distance just won't be known
            // for unpinned vendors (handled by distanceFor/sort already).
            const all = await getAllVendors('APPROVED');
            if (!cancelled) setVendors(all);
          }
        } else {
          setLocationDenied(true);
          const all = await getAllVendors('APPROVED');
          if (!cancelled) setVendors(all);
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

  function toggleCategory(cat: string) {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  const distanceFor = (vendor: Vendor): number | undefined =>
    userLocation && vendor.location ? distanceKm(userLocation, vendor.location) : undefined;

  const sortedVendors = useMemo(() => {
    const sorted = userLocation
      ? [...vendors].sort((a, b) => {
          const da = a.location ? distanceKm(userLocation, a.location) : Infinity;
          const db = b.location ? distanceKm(userLocation, b.location) : Infinity;
          return da - db;
        })
      : vendors;
    return sorted.filter((v) => {
      if (openNowOnly && !getOpenStatus(v.workingHours).isOpen) return false;
      if (activeCategories.length > 0) {
        const vCats = v.categories || [];
        if (!activeCategories.some((c) => vCats.includes(c))) return false;
      }
      if (searchText.trim() && !v.name.toLowerCase().includes(searchText.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [vendors, userLocation, openNowOnly, activeCategories, searchText]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Food near you</h1>
          <p className="text-stone-500 text-sm">Browse local vendors and order for pickup or delivery.</p>
        </div>
        <div className="flex rounded-lg border border-stone-200 overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={`p-2 ${view === 'list' ? 'bg-kasi-orange text-white' : 'text-stone-500'}`}
            aria-label="List view"
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setView('map')}
            className={`p-2 ${view === 'map' ? 'bg-kasi-orange text-white' : 'text-stone-500'}`}
            aria-label="Map view"
          >
            <MapIcon size={18} />
          </button>
        </div>
      </div>

      {!loading && (
        <div className="mb-3 flex items-center gap-2 text-xs text-stone-500 pl-11">
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

      {!loading && (
        <div className="mb-3 pl-11">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by dish or spot name"
              className="w-full border border-stone-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kasi-orange"
            />
          </div>
        </div>
      )}

      {!loading && (
        <div className="mb-4 flex flex-wrap gap-2 pl-11">
          <button
            onClick={() => setOpenNowOnly((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              openNowOnly
                ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                : 'border-stone-200 text-stone-600'
            }`}
          >
            Open now
          </button>
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                activeCategories.includes(cat)
                  ? 'border-kasi-orange bg-orange-50 text-kasi-orange'
                  : 'border-stone-200 text-stone-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingSpinner className="py-20" />
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
      ) : view === 'map' ? (
        <>
          <VendorMap vendors={sortedVendors} userLocation={userLocation} distanceFor={distanceFor} />
          {sortedVendors.length === 0 && (
            <>
              <EmptyState
                icon={<Store size={48} />}
                title="No spots near you yet"
                description="Tell us your favourite and we'll bring them on."
              />
              <RequestSpotForm className="max-w-md mx-auto mt-2 bg-white rounded-xl border border-stone-200 p-4" />
            </>
          )}
        </>
      ) : sortedVendors.length === 0 ? (
        <>
          <EmptyState
            icon={<Store size={48} />}
            title="No spots near you yet"
            description="Tell us your favourite and we'll bring them on."
          />
          <RequestSpotForm className="max-w-md mx-auto mt-2 bg-white rounded-xl border border-stone-200 p-4" />
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedVendors.map((vendor) => (
            <VendorCard key={vendor.id} vendor={vendor} distanceKm={distanceFor(vendor)} />
          ))}
        </div>
      )}

      {!loading && sortedVendors.length > 0 && (
        <RequestSpotForm className="max-w-md mx-auto mt-8 bg-white rounded-xl border border-stone-200 p-4" />
      )}
    </main>
  );
}
