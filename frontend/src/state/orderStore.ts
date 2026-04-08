import { create } from 'zustand';
import type { Order } from '../types';

interface OrderState {
  activeOrder: Order | null;
  orderHistory: Order[];
  setActiveOrder: (order: Order | null) => void;
  addToHistory: (order: Order) => void;
  clearHistory: () => void;
}

export const useOrderStore = create<OrderState>()((set) => ({
  activeOrder: null,
  orderHistory: [],

  setActiveOrder: (order) => set({ activeOrder: order }),

  addToHistory: (order) =>
    set((state) => ({
      orderHistory: [order, ...state.orderHistory],
    })),

  clearHistory: () => set({ orderHistory: [] }),
}));
