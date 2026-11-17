import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Order } from '../types';

interface OrderState {
  activeOrder: Order | null;
  orderHistory: Order[];
  /** Order IDs placed as a guest, kept in localStorage so a refresh or new tab doesn't lose them. */
  guestOrderIds: string[];
  setActiveOrder: (order: Order | null) => void;
  addToHistory: (order: Order) => void;
  clearHistory: () => void;
  addGuestOrderId: (orderId: string) => void;
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      activeOrder: null,
      orderHistory: [],
      guestOrderIds: [],

      setActiveOrder: (order) => set({ activeOrder: order }),

      addToHistory: (order) =>
        set((state) => ({
          orderHistory: [order, ...state.orderHistory],
        })),

      clearHistory: () => set({ orderHistory: [] }),

      addGuestOrderId: (orderId) =>
        set((state) => ({
          guestOrderIds: state.guestOrderIds.includes(orderId)
            ? state.guestOrderIds
            : [orderId, ...state.guestOrderIds],
        })),
    }),
    {
      name: 'kasi-guest-orders',
      partialize: (state) => ({ guestOrderIds: state.guestOrderIds }),
    }
  )
);
