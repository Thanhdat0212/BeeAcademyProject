import { apiClient } from './client';

export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';

export interface OrderItemResponse {
  courseId: string;
  priceAtPurchase: number;
  courseTitle: string;
  thumbnailUrl: string | null;
  teacherName: string | null;
  categoryName: string | null;
  grades: number[];
}

export interface OrderResponse {
  id: string;
  orderCode: number;
  totalAmount: number;
  status: OrderStatus;
  paymentRef: string;
  checkoutUrl: string | null;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  items: OrderItemResponse[];
}

export async function createOrder(courseIds: string[]): Promise<OrderResponse> {
  const res = await apiClient.post('/api/orders', { courseIds });
  return res.data.data;
}

export async function getOrderStatus(orderId: string): Promise<OrderResponse> {
  const res = await apiClient.get(`/api/orders/${orderId}`);
  return res.data.data;
}

export async function listOrders(): Promise<OrderResponse[]> {
  const res = await apiClient.get('/api/orders');
  return res.data.data;
}

export async function verifyPayment(orderId: string): Promise<OrderResponse> {
  const res = await apiClient.post(`/api/orders/${orderId}/verify`);
  return res.data.data;
}
