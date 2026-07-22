import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { RefreshCw, LogIn, Mail, Facebook } from 'lucide-react';
import { useSystemStore } from '../../store/useSystemStore';

const TIPS = [
  'Meo nhỏ: ôn lại 10 phút mỗi ngày hiệu quả hơn học dồn 2 tiếng cuối tuần đó!',
  'Bạn có biết? Một con ong phải bay khoảng 4.5 triệu km mới tạo ra 1kg mật.',
  'Trong lúc chờ, hãy thử ôn lại một chương bạn thấy khó nhất nhé.',
  'Ong mật giao tiếp với nhau bằng một "điệu nhảy" để chỉ đường đến hoa.',
  'Sắp xong rồi! Cảm ơn bạn đã kiên nhẫn chờ tổ ong hoàn thiện.',
];

/**
 * `maintenanceUntil` đến từ backend (mốc Admin bấm lưu bật bảo trì + thời
 * lượng cố định) - không tự tính "now + N giờ" ở client, để mọi người xem
 * cùng một deadline và không bị reset lại mỗi lần có ai đó load trang.
 */
function useCountdown(maintenanceUntil: string | null) {
  const target = maintenanceUntil ? new Date(maintenanceUntil).getTime() : null;
  const [remainingMs, setRemainingMs] = useState(
    target !== null ? Math.max(0, target - Date.now()) : null,
  );

  useEffect(() => {
    if (target === null) {
      setRemainingMs(null);
      return;
    }
    setRemainingMs(Math.max(0, target - Date.now()));
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, target - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remainingMs === null) {
    return null;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad(value: number) {
  return value.toString().padStart(2, '0');
}

export default function MaintenancePage() {
  const maintenanceUntil = useSystemStore((s) => s.maintenanceUntil);
  const countdown = useCountdown(maintenanceUntil);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center font-sans px-4 py-12 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'radial-gradient(var(--color-outline-variant, #bdc9c8) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="absolute top-10 left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-16 right-10 w-56 h-56 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 max-w-lg w-full flex flex-col items-center text-center py-14 px-8 bg-surface-container-lowest/90 backdrop-blur-xl rounded-2xl border border-outline-variant/30 shadow-xl"
      >
        <p className="font-bold text-lg text-primary mb-6">Bee Academy</p>

        <motion.div
          animate={{ y: [0, -14, 0], rotate: [0, 2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 text-5xl drop-shadow-sm"
        >
          🐝
        </motion.div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest">
            Đang bảo trì
          </span>
        </div>

        <h1 className="text-2xl font-extrabold text-on-surface mb-3">
          Hệ thống đang bảo trì
        </h1>

        <p className="text-on-surface-variant text-sm leading-relaxed mb-8 max-w-sm">
          Chúng tôi đang nâng cấp tổ ong để mang lại trải nghiệm tốt hơn cho
          các bạn nhỏ. Vui lòng quay lại sau nhé!
        </p>

        <div className="w-full mb-6">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-3">
            Dự kiến hoàn tất sau
          </p>
          <div className="flex items-center justify-center gap-3">
            {[
              { label: 'Giờ', value: countdown?.hours },
              { label: 'Phút', value: countdown?.minutes },
              { label: 'Giây', value: countdown?.seconds },
            ].map((unit, i) => (
              <div key={unit.label} className="flex items-center gap-3">
                <div className="flex flex-col items-center bg-surface-container rounded-xl px-4 py-3 min-w-[64px] border border-outline-variant/30">
                  <span className="text-2xl font-extrabold text-primary tabular-nums">
                    {unit.value !== undefined ? pad(unit.value) : '--'}
                  </span>
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">
                    {unit.label}
                  </span>
                </div>
                {i < 2 && (
                  <span className="text-xl font-bold text-outline-variant">:</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="w-full min-h-[40px] flex items-center justify-center mb-8">
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="text-xs text-on-surface-variant italic max-w-sm"
            >
              {TIPS[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>

          {/* Lối thoát cho Admin: đăng nhập vẫn hoạt động khi đang bảo trì
              để tắt lại chế độ này. */}
          <Link
            to="/login"
            className="flex items-center gap-2 px-6 py-3 bg-surface-container border border-outline-variant/40 text-on-surface rounded-full font-bold text-sm hover:bg-surface-container-high transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Đăng nhập
          </Link>

          <a
            href="mailto:thanhdatvv05@gmail.com"
            className="flex items-center gap-2 px-6 py-3 bg-surface-container border border-outline-variant/40 text-on-surface rounded-full font-bold text-sm hover:bg-surface-container-high transition-colors"
          >
            <Mail className="w-4 h-4" />
            Liên hệ hỗ trợ
          </a>
        </div>

        <div className="flex gap-3">
          <a
            href="https://www.facebook.com/thanh.at.980298/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-surface-container text-primary hover:bg-primary/10 transition-colors"
          >
            <Facebook className="w-5 h-5" />
          </a>
        </div>
      </motion.div>
    </div>
  );
}
