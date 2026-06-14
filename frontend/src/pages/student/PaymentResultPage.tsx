import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, Clock, ArrowRight, RotateCcw, BookOpen } from 'lucide-react';
import { getOrderStatus, verifyPayment, type OrderResponse } from '../../api/orderService';
import { useCartStore } from '../../store/useCartStore';
import { useCourseStore } from '../../store/useCourseStore';

type ResultStatus = 'success' | 'expired' | 'cancelled' | 'loading';

// PayOS redirects back with its own params: status=PAID, code=00, cancel=false/true
function resolveInitialStatus(searchParams: URLSearchParams): ResultStatus | null {
  const cancel = searchParams.get('cancel');
  const code = searchParams.get('code');
  const status = searchParams.get('status');

  if (cancel === 'true') return 'cancelled';
  if (code === '00' || status === 'PAID' || status === 'success') return 'success';
  if (status === 'CANCELLED' || status === 'cancelled') return 'cancelled';
  if (status === 'EXPIRED' || status === 'expired') return 'expired';
  // No recognizable param at all → redirect away
  if (!code && !status && !cancel) return null;
  return 'loading';
}

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCartStore();
  const { enrollCourses } = useCourseStore();

  const initialStatus = resolveInitialStatus(searchParams);
  const orderId = searchParams.get('orderId') ?? sessionStorage.getItem('pendingOrderId');

  const [status, setStatus] = useState<ResultStatus>(initialStatus ?? 'loading');
  const [order, setOrder] = useState<OrderResponse | null>(null);

  useEffect(() => {
    if (initialStatus === null) { navigate('/courses'); return; }
    if (!orderId) { setStatus(initialStatus); return; }

    const handlePaidOrder = (o: OrderResponse) => {
      setOrder(o);
      clearCart();
      sessionStorage.removeItem('pendingOrderId');
      // Sync courseIds vào Zustand để CourseDetailPage nhận ngay không cần reload
      if (o.items?.length) {
        enrollCourses(o.items.map(i => i.courseId));
      }
      setStatus('success');
    };

    getOrderStatus(orderId)
      .then(async o => {
        if (o.status === 'PAID') {
          handlePaidOrder(o);
        } else if (o.status === 'EXPIRED') {
          setStatus('expired');
        } else if (o.status === 'CANCELLED') {
          setStatus('cancelled');
        } else if (initialStatus === 'success') {
          // PayOS redirect với code=00 nhưng webhook chưa đến (local dev, firewall).
          // Gọi verify để backend tự check PayOS API và tạo enrollment nếu đã paid.
          try {
            const verified = await verifyPayment(orderId);
            if (verified.status === 'PAID') {
              handlePaidOrder(verified);
            } else if (verified.status === 'EXPIRED') {
              setStatus('expired');
            } else if (verified.status === 'CANCELLED') {
              setStatus('cancelled');
            } else {
              // PENDING sau verify → PayOS chưa nhận tiền
              setStatus('expired');
            }
          } catch {
            setStatus('expired');
          }
        } else {
          setOrder(o);
          setStatus(initialStatus ?? 'expired');
        }
      })
      .catch(() => setStatus(initialStatus));
  }, [orderId, navigate, clearCart]); // eslint-disable-line react-hooks/exhaustive-deps

  const config = {
    success: {
      icon: <CheckCircle2 className="w-14 h-14" />,
      iconBg: 'bg-green-500/20 text-green-500',
      glow: 'bg-green-500',
      title: 'Thanh toán thành công!',
      desc: 'Cảm ơn bạn đã tin tưởng Bee Academy. Khóa học đã được mở khóa trong tài khoản của bạn.',
    },
    expired: {
      icon: <Clock className="w-14 h-14" />,
      iconBg: 'bg-amber-500/20 text-amber-500',
      glow: 'bg-amber-500',
      title: 'Đơn hàng đã hết hạn',
      desc: 'Mã QR chỉ có hiệu lực trong 15 phút. Vui lòng thực hiện lại thanh toán.',
    },
    cancelled: {
      icon: <XCircle className="w-14 h-14" />,
      iconBg: 'bg-red-500/20 text-red-500',
      glow: 'bg-red-500',
      title: 'Đã hủy thanh toán',
      desc: 'Bạn đã hủy giao dịch. Giỏ hàng của bạn vẫn được giữ nguyên.',
    },
    loading: {
      icon: <div className="w-14 h-14 rounded-full border-4 border-primary border-t-transparent animate-spin" />,
      iconBg: 'bg-primary/10 text-primary',
      glow: 'bg-primary',
      title: 'Đang kiểm tra...',
      desc: '',
    },
  };

  const c = config[status];

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[100px] opacity-15 pointer-events-none ${c.glow}`} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-surface-container-lowest border border-outline-variant/40 rounded-[2rem] p-10 md:p-14 shadow-2xl w-full max-w-lg text-center relative z-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, delay: 0.2 }}
          className="flex justify-center mb-8"
        >
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${c.iconBg}`}>
            {c.icon}
          </div>
        </motion.div>

        <h1 className="text-3xl font-extrabold text-on-surface mb-4">{c.title}</h1>
        {c.desc && <p className="text-on-surface-variant text-lg mb-6 leading-relaxed">{c.desc}</p>}

        {/* Thông tin đơn hàng khi thành công */}
        {status === 'success' && order && (
          <div className="bg-surface-container rounded-2xl p-4 mb-8 text-left text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Mã đơn hàng:</span>
              <span className="font-mono font-bold text-on-surface">{order.paymentRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Số tiền:</span>
              <span className="font-bold text-primary">{order.totalAmount.toLocaleString('vi-VN')}đ</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Số khóa học:</span>
              <span className="font-semibold text-on-surface">{order.items.length} khóa</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {status === 'success' && (
            <>
              <Link to="/courses" className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                Vào Học Ngay <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/orders" className="w-full py-3 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                <BookOpen className="w-4 h-4" /> Xem lịch sử mua hàng
              </Link>
            </>
          )}

          {(status === 'expired' || status === 'cancelled') && (
            <>
              <Link to="/checkout" className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5" /> Thử Lại Thanh Toán
              </Link>
              <Link to="/courses" className="w-full py-3 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-semibold transition-colors">
                Quay về trang khóa học
              </Link>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
