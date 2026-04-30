/**
 * Helpers for displaying order numbers + payment references consistently.
 *
 * Backwards-compatible: orders created before the orderNumber rollout fall
 * back to the last 6 chars of the UUID id, matching the old display logic.
 */
import type { Order } from '../types';

/** "KOTA-260430-0017" → preferred display; otherwise UUID short-id. */
export function displayOrderNumber(order: Pick<Order, 'id' | 'orderNumber'>): string {
    if (order.orderNumber) return order.orderNumber;
    return order.id.slice(-6).toUpperCase();
}

/** Bank-friendly reference (no dashes). Falls back to displayOrderNumber. */
export function displayPaymentRef(order: Pick<Order, 'id' | 'orderNumber' | 'paymentRef'>): string {
    if (order.paymentRef) return order.paymentRef;
    return displayOrderNumber(order).replace(/[^A-Za-z0-9]/g, '');
}
