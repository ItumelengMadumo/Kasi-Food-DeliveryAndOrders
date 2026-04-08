import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCartStore } from '../state/cartStore';
import type { MenuItem } from '../types';

const mockItem: MenuItem = {
  id: 'item-1',
  vendorId: 'vendor-1',
  name: 'Pap & Wors',
  price: 45,
  available: true,
  createdAt: new Date().toISOString(),
};

const mockItem2: MenuItem = {
  id: 'item-2',
  vendorId: 'vendor-1',
  name: 'Chicken Feet',
  price: 30,
  available: true,
  createdAt: new Date().toISOString(),
};

describe('cartStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useCartStore.setState({ vendorId: null, items: [] });
  });

  it('adds an item to the cart', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem('vendor-1', mockItem);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].menuItem.id).toBe('item-1');
    expect(result.current.items[0].quantity).toBe(1);
    expect(result.current.vendorId).toBe('vendor-1');
  });

  it('increments quantity when adding same item again', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem('vendor-1', mockItem);
      result.current.addItem('vendor-1', mockItem);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
  });

  it('calculates subtotal correctly', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem('vendor-1', mockItem, 2);  // 2 × R45 = R90
      result.current.addItem('vendor-1', mockItem2, 1); // 1 × R30 = R30
    });

    expect(result.current.subtotal()).toBe(120);
  });

  it('removes an item from cart', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem('vendor-1', mockItem);
      result.current.removeItem('item-1');
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('clears cart when adding item from different vendor', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem('vendor-1', mockItem);
    });

    const differentVendorItem: MenuItem = { ...mockItem2, vendorId: 'vendor-2' };

    act(() => {
      result.current.addItem('vendor-2', differentVendorItem);
    });

    expect(result.current.vendorId).toBe('vendor-2');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].menuItem.id).toBe('item-2');
  });

  it('clears the cart', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem('vendor-1', mockItem);
      result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.vendorId).toBeNull();
  });

  it('counts total items in cart', () => {
    const { result } = renderHook(() => useCartStore());

    act(() => {
      result.current.addItem('vendor-1', mockItem, 3);
      result.current.addItem('vendor-1', mockItem2, 2);
    });

    expect(result.current.totalItems()).toBe(5);
  });
});
