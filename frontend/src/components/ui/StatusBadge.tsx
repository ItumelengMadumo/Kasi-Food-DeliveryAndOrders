import { clsx } from 'clsx';
import type { OrderStatus } from '../../types';

const STATUS_CONFIG: Record<OrderStatus, { label: string; classes: string }> = {
  PENDING: { label: 'Pending', classes: 'bg-yellow-100 text-yellow-800' },
  ACCEPTED: { label: 'Accepted', classes: 'bg-blue-100 text-blue-800' },
  PREPARING: { label: 'Preparing', classes: 'bg-purple-100 text-purple-800' },
  READY: { label: 'Ready', classes: 'bg-green-100 text-green-800' },
  OUT_FOR_DELIVERY: { label: 'On the way', classes: 'bg-orange-100 text-orange-800' },
  COMPLETED: { label: 'Completed', classes: 'bg-stone-100 text-stone-700' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-red-100 text-red-700' },
};

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}

// Star rating display
interface StarRatingProps {
  rating: number;
  max?: number;
  size?: 'sm' | 'md';
}

export function StarRating({ rating, max = 5, size = 'md' }: StarRatingProps) {
  return (
    <span className={clsx('flex items-center gap-0.5', size === 'sm' ? 'text-xs' : 'text-sm')}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < Math.round(rating) ? 'text-yellow-400' : 'text-stone-300'}>
          ★
        </span>
      ))}
      <span className="ml-1 text-stone-500">({rating.toFixed(1)})</span>
    </span>
  );
}
