import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Star, Truck } from 'lucide-react';
import { Card } from './ui/Card';
import type { Vendor } from '../types';

interface VendorCardProps {
  vendor: Vendor;
}

export function VendorCard({ vendor }: VendorCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      hoverable
      onClick={() => navigate(`/vendor/${vendor.id}`)}
      className="flex flex-col"
    >
      {/* Image */}
      <div className="h-40 bg-stone-100 relative overflow-hidden">
        {vendor.imageUrl ? (
          <img
            src={vendor.imageUrl}
            alt={vendor.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            🍔
          </div>
        )}
        {vendor.status !== 'APPROVED' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-semibold text-sm bg-black/60 px-3 py-1 rounded-full">
              Currently Closed
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-1.5">
        <h3 className="font-bold text-stone-900 text-lg leading-tight">{vendor.name}</h3>

        {vendor.description && (
          <p className="text-stone-500 text-sm line-clamp-2">{vendor.description}</p>
        )}

        <div className="flex flex-wrap gap-3 text-sm text-stone-500 mt-1">
          {/* Rating */}
          {vendor.rating != null && (
            <span className="flex items-center gap-1">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              {vendor.rating.toFixed(1)}
              {vendor.totalReviews != null && (
                <span className="text-stone-400">({vendor.totalReviews})</span>
              )}
            </span>
          )}

          {/* Delivery */}
          {vendor.deliveryType && vendor.deliveryValue != null && (
            <span className="flex items-center gap-1">
              <Truck size={14} />
              {vendor.deliveryType === 'FLAT'
                ? `R${vendor.deliveryValue} delivery`
                : `${vendor.deliveryValue}% delivery fee`}
            </span>
          )}

          {/* Address */}
          <span className="flex items-center gap-1">
            <MapPin size={14} />
            <span className="truncate max-w-[160px]">{vendor.address}</span>
          </span>
        </div>

        {/* Tags */}
        <div className="flex gap-2 mt-1">
          {!vendor.hasBankAccount && (
            <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
              Cash on delivery
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
