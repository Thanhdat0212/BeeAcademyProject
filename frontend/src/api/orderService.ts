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
  subtotalAmount: number;
  rewardDiscountAmount: number;
  rewardVoucherId: string | null;
  totalAmount: number;
  status: OrderStatus;
  paymentRef: string;
  checkoutUrl: string | null;
  createdAt: string;
  expiresAt: string;
  paidAt: string | null;
  items: OrderItemResponse[];
}

export async function createOrder(courseIds: string[], rewardVoucherId?: string | null): Promise<OrderResponse> {
  const res = await apiClient.post('/api/orders', { courseIds, rewardVoucherId: rewardVoucherId ?? null });
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

export async function cancelOrder(orderId: string): Promise<OrderResponse> {
  const res = await apiClient.post(`/api/orders/${orderId}/cancel`);
  return res.data.data;
}

// Đối soát tất cả đơn PENDING với PayOS — fix bug thanh toán xong nhưng đóng
// tab/reload trước khi về payment-result nên enrollment chưa được tạo.
// Trả về danh sách đơn có thay đổi trạng thái (PAID/CANCELLED/EXPIRED).
export async function reconcileOrders(): Promise<OrderResponse[]> {
  const res = await apiClient.post('/api/orders/reconcile');
  return res.data.data;
}
