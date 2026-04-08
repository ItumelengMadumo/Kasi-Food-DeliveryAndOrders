import { describe, it, expect } from 'vitest';

// Replicated from updateOrderStatus Lambda for unit testing
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['OUT_FOR_DELIVERY', 'COMPLETED'],
  OUT_FOR_DELIVERY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

function validateTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

describe('Order Status Transitions', () => {
  it('allows PENDING → ACCEPTED', () => {
    expect(validateTransition('PENDING', 'ACCEPTED')).toBe(true);
  });

  it('allows PENDING → CANCELLED', () => {
    expect(validateTransition('PENDING', 'CANCELLED')).toBe(true);
  });

  it('allows ACCEPTED → PREPARING', () => {
    expect(validateTransition('ACCEPTED', 'PREPARING')).toBe(true);
  });

  it('allows PREPARING → READY', () => {
    expect(validateTransition('PREPARING', 'READY')).toBe(true);
  });

  it('allows READY → OUT_FOR_DELIVERY', () => {
    expect(validateTransition('READY', 'OUT_FOR_DELIVERY')).toBe(true);
  });

  it('allows READY → COMPLETED (pickup)', () => {
    expect(validateTransition('READY', 'COMPLETED')).toBe(true);
  });

  it('allows OUT_FOR_DELIVERY → COMPLETED', () => {
    expect(validateTransition('OUT_FOR_DELIVERY', 'COMPLETED')).toBe(true);
  });

  it('blocks COMPLETED → PENDING (no going back)', () => {
    expect(validateTransition('COMPLETED', 'PENDING')).toBe(false);
  });

  it('blocks CANCELLED → ACCEPTED', () => {
    expect(validateTransition('CANCELLED', 'ACCEPTED')).toBe(false);
  });

  it('blocks PENDING → COMPLETED (skipping steps)', () => {
    expect(validateTransition('PENDING', 'COMPLETED')).toBe(false);
  });

  it('blocks PREPARING → OUT_FOR_DELIVERY (skipping READY)', () => {
    expect(validateTransition('PREPARING', 'OUT_FOR_DELIVERY')).toBe(false);
  });
});

// Delivery fee calculation logic
function calculateDeliveryFee(
  deliveryType: 'PERCENTAGE' | 'FLAT',
  deliveryValue: number,
  subtotal: number,
  deliveryMethod: 'DELIVERY' | 'PICKUP'
): number {
  if (deliveryMethod === 'PICKUP') return 0;
  if (deliveryType === 'FLAT') return deliveryValue;
  if (deliveryType === 'PERCENTAGE') return parseFloat(((deliveryValue / 100) * subtotal).toFixed(2));
  return 0;
}

describe('Delivery Fee Calculation', () => {
  it('returns 0 for pickup orders', () => {
    expect(calculateDeliveryFee('FLAT', 20, 100, 'PICKUP')).toBe(0);
    expect(calculateDeliveryFee('PERCENTAGE', 10, 100, 'PICKUP')).toBe(0);
  });

  it('returns flat fee for FLAT type', () => {
    expect(calculateDeliveryFee('FLAT', 15, 100, 'DELIVERY')).toBe(15);
    expect(calculateDeliveryFee('FLAT', 20, 200, 'DELIVERY')).toBe(20);
  });

  it('calculates percentage of subtotal for PERCENTAGE type', () => {
    expect(calculateDeliveryFee('PERCENTAGE', 10, 100, 'DELIVERY')).toBe(10);
    expect(calculateDeliveryFee('PERCENTAGE', 8, 150, 'DELIVERY')).toBe(12);
    expect(calculateDeliveryFee('PERCENTAGE', 5, 200, 'DELIVERY')).toBe(10);
  });
});
