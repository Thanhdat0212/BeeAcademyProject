import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  PlayCircle,
  Receipt,
  RefreshCw,
  Search,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { listOrders, verifyPayment } from '../../api/orderService';
import type { OrderResponse, OrderStatus } from '../../api/orderService';
import { notify } from '../../lib/toast';

type StatusFilter = 'ALL' | OrderStatus;

const STATUS_CONFIG: Record<OrderStatus, {
  label: string;
  className: string;
  icon: React.ReactNode;
}> = {
  PAID: {
    label: 'Đã thanh toán',
    className: 'bg-green-500/10 text-green-700',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  PENDING: {
    label: 'Chờ thanh toán',
    className: 'bg-amber-500/10 text-amber-700',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  CANCELLED: {
    label: 'Đã hủy',
    className: 'bg-red-500/10 text-red-700',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  EXPIRED: {
    label: 'Hết hạn',
    className: 'bg-slate-500/10 text-slate-700',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
};

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Chưa có';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function EmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 border-dashed">
      <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-5">
        <ShoppingBag className="w-9 h-9 text-on-surface-variant opacity-50" />
      </div>
      <h3 className="text-xl font-bold text-on-surface mb-2">Chưa có đơn hàng nào</h3>
      <p className="text-on-surface-variant text-sm text-center max-w-sm mb-6">
        Các giao dịch mua khóa học của bạn sẽ xuất hiện tại đây sau khi tạo đơn.
      </p>
      <button
        onClick={() => navigate('/courses')}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
      >
        <BookOpen className="w-4 h-4" />
        Khám phá khóa học
      </button>
    </div>
  );
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  async function loadOrders() {
    try {
      setLoading(true);
      const data = await listOrders();
      setOrders(data);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được lịch sử mua hàng');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const stats = useMemo(() => {
    const paidOrders = orders.filter(order => order.status === 'PAID');
    return {
      paidAmount: paidOrders.reduce((sum, order) => sum + order.totalAmount, 0),
      ownedCourses: paidOrders.reduce((sum, order) => sum + order.items.length, 0),
      pendingOrders: orders.filter(order => order.status === 'PENDING').length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return orders
      .filter(order => statusFilter === 'ALL' || order.status === statusFilter)
      .filter(order => {
        if (!q) return true;
        return (
          order.paymentRef.toLowerCase().includes(q) ||
          String(order.orderCode).includes(q) ||
          order.items.some(item =>
            item.courseTitle.toLowerCase().includes(q) ||
            (item.teacherName ?? '').toLowerCase().includes(q) ||
            (item.categoryName ?? '').toLowerCase().includes(q),
          )
        );
      });
  }, [orders, searchTerm, statusFilter]);

  async function handleVerify(order: OrderResponse) {
    try {
      setVerifyingId(order.id);
      const updated = await verifyPayment(order.id);
      setOrders(prev => prev.map(item => item.id === updated.id ? updated : item));
      if (updated.status === 'PAID') {
        notify.success('Thanh toán đã được xác nhận');
      } else {
        notify.error('PayOS chưa xác nhận thanh toán cho đơn này');
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không kiểm tra được thanh toán');
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner
        title="Lịch sử mua hàng"
        subtitle={`${orders.length} đơn hàng · ${stats.ownedCourses} khóa đã sở hữu`}
      />

      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-on-surface-variant">Tổng đơn hàng</p>
                  <p className="text-2xl font-extrabold text-on-surface">{orders.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-700 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-on-surface-variant">Đã thanh toán</p>
                  <p className="text-2xl font-extrabold text-on-surface">{formatVnd(stats.paidAmount)}</p>
                </div>
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-on-surface-variant">Đang chờ</p>
                  <p className="text-2xl font-extrabold text-on-surface">{stats.pendingOrders}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 shadow-sm mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_auto] gap-3">
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Tìm kiếm</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Mã đơn, tên khóa học, giáo viên..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5 block">Trạng thái</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg focus:outline-none focus:border-primary text-on-surface"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="PAID">Đã thanh toán</option>
                  <option value="PENDING">Chờ thanh toán</option>
                  <option value="EXPIRED">Hết hạn</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  onClick={loadOrders}
                  disabled={loading}
                  className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/50 text-sm font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center text-on-surface-variant">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState />
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center bg-surface-container-lowest border border-outline-variant/30 rounded-2xl">
              <Search className="w-10 h-10 text-on-surface-variant/40 mx-auto mb-3" />
              <p className="text-on-surface-variant">Không có đơn hàng nào khớp bộ lọc.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredOrders.map((order, idx) => (
                <motion.article
                  key={order.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, ease: 'easeOut' }}
                  className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-outline-variant/20 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-extrabold text-on-surface">Đơn #{order.paymentRef}</h3>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                        <span className="inline-flex items-center gap-1">
                          <Receipt className="w-3.5 h-3.5" />
                          PayOS: {order.orderCode}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" />
                          Tạo: {formatDateTime(order.createdAt)}
                        </span>
                        {order.status === 'PAID' && (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Thanh toán: {formatDateTime(order.paidAt)}
                          </span>
                        )}
                        {order.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Hết hạn: {formatDateTime(order.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 lg:flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-on-surface-variant">Tổng tiền</p>
                        <p className="text-lg font-extrabold text-primary">{formatVnd(order.totalAmount)}</p>
                      </div>
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => handleVerify(order)}
                          disabled={verifyingId === order.id}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
                        >
                          {verifyingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                          Kiểm tra
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-outline-variant/15">
                    {order.items.map(item => (
                      <div key={`${order.id}-${item.courseId}`} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.courseTitle}
                            className="w-full md:w-32 h-28 md:h-20 rounded-xl object-cover border border-outline-variant/30"
                          />
                        ) : (
                          <div className="w-full md:w-32 h-28 md:h-20 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-center text-on-surface-variant">
                            <BookOpen className="w-7 h-7 opacity-50" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-on-surface line-clamp-2">{item.courseTitle}</h4>
                          <p className="text-sm text-on-surface-variant mt-1">
                            {item.teacherName ?? 'Bee Academy'}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.categoryName && (
                              <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium">
                                {item.categoryName}
                              </span>
                            )}
                            {item.grades.length > 0 && (
                              <span className="text-xs bg-surface-container px-2.5 py-0.5 rounded-full text-on-surface-variant font-medium">
                                Lớp {item.grades.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex md:flex-col items-center md:items-end justify-between gap-3 md:flex-shrink-0">
                          <span className="text-primary font-extrabold">{formatVnd(item.priceAtPurchase)}</span>
                          {order.status === 'PAID' && (
                            <button
                              onClick={() => navigate(`/courses/${item.courseId}`)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 hover:-translate-y-0.5 transition-all shadow-sm shadow-primary/20"
                            >
                              <PlayCircle className="w-4 h-4" />
                              Vào học
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
