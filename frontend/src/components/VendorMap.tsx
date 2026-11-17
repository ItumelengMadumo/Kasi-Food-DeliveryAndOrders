import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { formatDistanceKm } from '../domain/distance';
import { getOpenStatus } from '../domain/hours';
import type { Vendor } from '../types';
import type { Coordinates } from '../domain/distance';

// Leaflet's default marker icons reference image files via relative URLs that
// break under bundlers — point them at a CDN instead of shipping the assets.
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const userIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'kasi-user-marker',
});

/**
 * Leaflet only reads `center`/`zoom` on first mount — it ignores prop changes
 * afterwards. Geolocation resolves asynchronously after that first render, so
 * without this the map stays stuck on the fallback view even once the user's
 * real position is known.
 */
function RecenterOnLocate({ position }: { position: Coordinates | null }) {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (!position || hasCentered.current) return;
    hasCentered.current = true;
    map.setView([position.lat, position.lng], 14);
  }, [position, map]);

  // Leaflet sizes itself off its container's dimensions at mount time; if the
  // container was display:none or still animating in, it measures 0x0 and
  // tiles never load until a manual resize nudge.
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(id);
  }, [map]);

  return null;
}

interface VendorMapProps {
  vendors: Vendor[];
  userLocation: Coordinates | null;
  distanceFor: (vendor: Vendor) => number | undefined;
}

export function VendorMap({ vendors, userLocation, distanceFor }: VendorMapProps) {
  const navigate = useNavigate();
  const pinned = vendors.filter((v) => v.location);
  const center: [number, number] = userLocation
    ? [userLocation.lat, userLocation.lng]
    : pinned.length > 0
      ? [pinned[0].location!.lat, pinned[0].location!.lng]
      : [-26.2041, 28.0473]; // Johannesburg fallback

  return (
    <div className="h-[60vh] min-h-[320px] max-h-[620px] w-full rounded-xl overflow-hidden border border-stone-200 sm:h-[480px]">
      <MapContainer
        center={center}
        zoom={userLocation ? 13 : 11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <RecenterOnLocate position={userLocation} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}
        {pinned.map((vendor) => {
          const openStatus = getOpenStatus(vendor.workingHours);
          const d = distanceFor(vendor);
          return (
            <Marker
              key={vendor.id}
              position={[vendor.location!.lat, vendor.location!.lng]}
              icon={markerIcon}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{vendor.name}</div>
                  <div className={openStatus.isOpen ? 'text-green-700' : 'text-stone-500'}>
                    {openStatus.isOpen ? 'Open' : openStatus.label}
                  </div>
                  {d != null && <div className="text-stone-500">{formatDistanceKm(d)}</div>}
                  <button
                    onClick={() => navigate(`/vendor/${vendor.id}`)}
                    className="mt-1 text-kasi-orange font-semibold underline"
                  >
                    View vendor
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
