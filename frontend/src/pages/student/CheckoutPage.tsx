import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, ShieldCheck, CreditCard, Loader2 } from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import { useCartStore } from '../../store/useCartStore';
import { notify } from '../../lib/toast';
import { createOrder } from '../../api/orderService';
import { getCourseDetail } from '../../api/courseService';
import { isApiError } from '../../api/client';

export default function CheckoutPage() {
  const { items, removeFromCart } = useCartStore();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  // freshPrices: map courseId → giá thật từ DB (tránh stale localStorage)
  const [freshPrices, setFreshPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (items.length === 0) return;
    Promise.all(
      items.map(item =>
        getCourseDetail(item.id)
          .then(c => ({ id: item.id, price: c.salePriceVnd ?? c.priceVnd }))
          .catch(() => ({ id: item.id, price: item.priceVnd }))
      )
    ).then(results => {
      const map: Record<string, number> = {};
      results.forEach(r => { map[r.id] = r.price; });
      setFreshPrices(map);
    });
  }, []);

  const getItemPrice = (item: typeof items[0]) => freshPrices[item.id] ?? item.priceVnd;
  const totalAmount = items.reduce((sum, item) => sum + getItemPrice(item), 0);

  const handleCheckout = async () => {
    if (items.length === 0) { notify.error('Giỏ hàng của bạn đang trống!'); return; }

    setIsCreating(true);
    try {
      const courseIds = items.map(i => i.id);
      const order = await createOrder(courseIds);

      if (!order.checkoutUrl) {
        notify.error('Không nhận được link thanh toán. Vui lòng thử lại.');
        return;
      }

      // Lưu orderId vào sessionStorage để PaymentResultPage lấy khi PayOS redirect về
      sessionStorage.setItem('pendingOrderId', order.id);

      // Redirect sang trang thanh toán PayOS
      window.location.href = order.checkoutUrl;

    } catch (err: unknown) {
      notify.error(isApiError(err) ? err.message : 'Không thể tạo đơn hàng. Vui lòng thử lại.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <main className="flex-grow max-w-[1200px] mx-auto w-full px-4 md:px-10 py-10">
        <Link to="/courses" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary mb-8 transition-colors font-medium">
          <ArrowLeft className="w-5 h-5" /> Tiếp tục tìm khóa học
        </Link>

        <h1 className="text-3xl font-extrabold text-on-surface mb-8">Giỏ Hàng Của Bạn</h1>

        {items.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-3xl p-10 text-center border border-outline-variant/30">
            <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6 text-on-surface-variant">
              <CartIcon className="w-10 h-10 opacity-50" />
            </div>
            <h2 className="text-2xl font-bold text-on-surface mb-2">Giỏ hàng trống</h2>
            <p className="text-on-surface-variant mb-6">Bạn chưa chọn khóa học nào. Hãy khám phá nhé!</p>
            <Link to="/courses" className="inline-flex px-8 py-3 bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-colors">
              Khám Phá Khóa Học
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-10">
            {/* Danh sách khóa học */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-4 flex gap-4 md:gap-6 items-center shadow-sm"
                >
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-xl flex-shrink-0" />
                  ) : (
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl flex-shrink-0 bg-surface-container flex items-center justify-center text-on-surface-variant">
                      <CreditCard className="w-8 h-8 opacity-40" />
                    </div>
                  )}
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold text-on-surface mb-1 line-clamp-2">{item.title}</h3>
                    <div className="text-primary font-extrabold text-xl">{getItemPrice(item).toLocaleString('vi-VN')}đ</div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-3 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Ô thanh toán */}
            <div className="lg:col-span-1">
              <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-[2rem] p-6 shadow-xl shadow-primary/5 sticky top-28">
                <h3 className="text-xl font-bold text-on-surface mb-6">Tổng đơn hàng</h3>

                <div className="flex justify-between items-center mb-4 text-on-surface-variant">
                  <span>Tạm tính ({items.length} khóa học):</span>
                  <span className="font-semibold text-on-surface">{totalAmount.toLocaleString('vi-VN')}đ</span>
                </div>
                <hr className="border-outline-variant/30 my-4" />
                <div className="flex justify-between items-center mb-8">
                  <span className="font-bold text-on-surface">Tổng cộng:</span>
                  <span className="text-3xl font-extrabold text-primary">{totalAmount.toLocaleString('vi-VN')}đ</span>
                </div>

                {/* PayOS badge */}
                <div className="flex items-center gap-3 p-4 rounded-xl border border-outline-variant/40 bg-surface-container mb-8">
                  <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-on-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-on-surface text-sm">Thanh toán qua PayOS</div>
                    <div className="text-on-surface-variant text-xs">Chuyển khoản, thẻ ATM, ví điện tử</div>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={isCreating}
                  className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-lg shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                  {isCreating ? 'Đang tạo đơn hàng...' : 'Tiến Hành Thanh Toán'}
                </button>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  Bảo mật bởi PayOS — chuẩn NAPAS
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function CartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}
