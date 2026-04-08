import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, MenuItem } from '../types';

interface CartState {
  vendorId: string | null;
  items: CartItem[];
  addItem: (vendorId: string, menuItem: MenuItem, quantity?: number) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: () => number;
  totalItems: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      vendorId: null,
      items: [],

      addItem: (vendorId, menuItem, quantity = 1) => {
        const { vendorId: currentVendorId, items } = get();

        // If adding from a different vendor, clear cart first
        if (currentVendorId && currentVendorId !== vendorId) {
          set({
            vendorId,
            items: [{ menuItem, quantity }],
          });
          return;
        }

        const existing = items.find((i) => i.menuItem.id === menuItem.id);
        if (existing) {
          set({
            vendorId,
            items: items.map((i) =>
              i.menuItem.id === menuItem.id
                ? { ...i, quantity: i.quantity + quantity }
                : i
            ),
          });
        } else {
          set({ vendorId, items: [...items, { menuItem, quantity }] });
        }
      },

      removeItem: (menuItemId) =>
        set((state) => ({
          items: state.items.filter((i) => i.menuItem.id !== menuItemId),
          vendorId: state.items.length <= 1 ? null : state.vendorId,
        })),

      updateQuantity: (menuItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.menuItem.id === menuItemId ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ vendorId: null, items: [] }),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.menuItem.price * i.quantity, 0),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'kasi-cart' }
  )
);
