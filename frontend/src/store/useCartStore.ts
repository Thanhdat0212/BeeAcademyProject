import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Course } from '../data/mockCourses';

// Lưu trữ các trường cần thiết cho giỏ hàng
export interface CartItem {
  id: string;
  title: string;
  price: string;
  image: string;
}

interface CartState {
  items: CartItem[];
  addToCart: (course: Course) => void;
  removeFromCart: (courseId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

// Helper: chuyển "499.000đ" -> 499000
const parsePrice = (priceStr?: string) => {
  if (!priceStr) return 0;
  return parseInt(priceStr.replace(/\D/g, '')) || 0;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
      addToCart: (course) => set((state) => {
        // Kiểm tra xem đã có trong giỏ chưa
        const exists = state.items.find(item => item.id === course.id);
        if (exists) return state; // Không thêm trùng
        
        return {
          items: [...state.items, {
            id: course.id,
            title: course.title,
            price: course.price || '0đ',
            image: course.image
          }]
        };
      }),
      
      removeFromCart: (courseId) => set((state) => ({
        items: state.items.filter(item => item.id !== courseId)
      })),
      
      clearCart: () => set({ items: [] }),
      
      getTotal: () => {
        const { items } = get();
        return items.reduce((total, item) => total + parsePrice(item.price), 0);
      }
    }),
    {
      name: 'bee-academy-cart',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

