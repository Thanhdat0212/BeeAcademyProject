// ═══════════════════════════════════════════════════════════════════════════════
// PAGE: ComingSoonPage
//
// VỊ TRÍ TRONG HỆ THỐNG:
//   Dùng chung cho mọi trang dashboard chưa có nội dung thực.
//   Reuse bằng cách truyền `title` và `subtitle` khác nhau từ App.tsx.
//
// PROPS:
//   title    — tên trang (hiển thị trên PageBanner và tiêu đề nội dung)
//   subtitle — (optional) mô tả ngắn trên PageBanner
//
// MỤC ĐÍCH:
//   Khi user click mục sidebar/dropdown chưa có trang riêng, họ vẫn được
//   điều hướng đến đây và thấy sidebar bên trái đầy đủ — không bị 404.
// ═══════════════════════════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Construction, ArrowLeft } from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';

interface ComingSoonPageProps {
  title: string;
  subtitle?: string;
}

export default function ComingSoonPage({ title, subtitle }: ComingSoonPageProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">

      {/* Header cố định phía trên */}
      <DashboardHeader />

      {/* Banner với tiêu đề trang — truyền từ props */}
      <PageBanner title={title} subtitle={subtitle} />

      {/* Nội dung full-width — sidebar nằm trong header (click avatar) */}
      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main>

          {/* Card "Đang phát triển" — căn giữa trong vùng nội dung */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center py-24 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 border-dashed"
          >
            {/* Icon minh họa */}
            <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center mb-6">
              <Construction className="w-11 h-11 text-primary opacity-60" />
            </div>

            {/* Tiêu đề trạng thái */}
            <h3 className="text-2xl font-extrabold text-on-surface mb-3">
              Tính năng đang phát triển
            </h3>

            {/* Mô tả */}
            <p className="text-on-surface-variant text-sm text-center max-w-sm mb-8 leading-relaxed">
              Chúng tôi đang hoàn thiện trang <span className="font-semibold text-on-surface">{title}</span>.
              Tính năng sẽ sớm được ra mắt — vui lòng quay lại sau!
            </p>

            {/* Nút quay lại khóa học */}
            <button
              onClick={() => navigate('/courses')}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại khóa học
            </button>
          </motion.div>

        </main>
      </div>
    </div>
  );
}
