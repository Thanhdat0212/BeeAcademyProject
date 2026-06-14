import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItem {
  id: string;
  title: string;
  priceVnd: number;
  image: string;
}

interface CartState {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (courseId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addToCart: (item) => set((state) => {
        if (state.items.find(i => i.id === item.id)) return state;
        return { items: [...state.items, item] };
      }),

      removeFromCart: (courseId) => set((state) => ({
        items: state.items.filter(item => item.id !== courseId),
      })),

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        return get().items.reduce((total, item) => total + item.priceVnd, 0);
      },
    }),
    {
      name: 'bee-academy-cart',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (_state, _fromVersion) => ({ items: [] }),
    }
  )
);
