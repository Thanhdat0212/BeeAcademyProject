// ═══════════════════════════════════════════════════════════════════════════════
// TRANG LỊCH SỬ MUA HÀNG — OrdersPage.tsx
//
// VỊ TRÍ TRONG HỆ THỐNG:
//   URL: /orders  (khớp với mục "Lịch sử mua hàng" trong DashboardSidebar)
//   Người dùng đến từ: Avatar dropdown header (click "Lịch sử mua hàng")
//   Người dùng đi đến: CourseDetailPage (/courses/:id) khi click "Tiếp tục học"
//
// NỘI DUNG TRANG:
//   Danh sách các khóa học đã mua (isEnrolled hoặc purchasedIds từ Zustand)
//   Mỗi khóa học: thumbnail, tên, giảng viên, tag môn/lớp, giá, nút "Tiếp tục học"
//
// TRẠNG THÁI EMPTY:
//   Nếu chưa mua khóa học nào → hiển thị empty state với nút "Khám phá ngay"
//
// LƯU Ý:
//   Chức năng soạn tin nhắn đã chuyển sang MessagesPage (/messages)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { PlayCircle, BookOpen, ShoppingBag } from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { MOCK_COURSES } from '../../data/mockCourses';
import { useCourseStore } from '../../store/useCourseStore';
import { getCourseDetail } from '../../api/courseService';
import { adaptCourseDetail } from '../../api/adapter';

// ─── Empty State: chưa có khóa học nào ────────────────────────────────────────
function EmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 border-dashed">
      <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-5">
        <ShoppingBag className="w-9 h-9 text-on-surface-variant opacity-50" />
      </div>
      <h3 className="text-xl font-bold text-on-surface mb-2">Chưa có khóa học nào</h3>
      <p className="text-on-surface-variant text-sm text-center max-w-sm mb-6">
        Bạn chưa mua khóa học nào. Hãy khám phá hàng trăm khóa học chất lượng tại Bee Academy!
      </p>
      <button
        onClick={() => navigate('/courses')}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
      >
        <BookOpen className="w-4 h-4" />
        Khám phá ngay
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const navigate = useNavigate();

  // purchasedIds: các khóa học mua qua CheckoutPage trong session này
  const purchasedIds = useCourseStore(state => state.purchasedIds);

  // State lưu các khóa học thực tế đã mua từ backend
  const [purchasedRealCourses, setPurchasedRealCourses] = useState<(typeof MOCK_COURSES)[0][]>([]);

  // ── Effect: fetch các khóa học thực tế đã mua (BE chưa có API my-courses) ──
  useEffect(() => {
    // Lọc ra các ID thật (UUID, thường có độ dài 36 ký tự hoặc không thuộc mock 'c1'-'c9')
    const realPurchasedIds = purchasedIds.filter(id => id.length > 5);
    
    if (realPurchasedIds.length === 0) {
      setPurchasedRealCourses([]);
      return;
    }

    // Fetch song song chi tiết của từng khóa học thật
    Promise.all(
      realPurchasedIds.map(id =>
        getCourseDetail(id)
          .then(adaptCourseDetail)
          .catch(err => {
            console.error(`Không thể tải khóa học đã mua ${id}:`, err);
            return null;
          })
      )
    ).then(details => {
      const validDetails = details.filter((d): d is (typeof MOCK_COURSES)[0] => d !== null);
      setPurchasedRealCourses(validDetails);
    });
  }, [purchasedIds]);

  // Ghép 2 nguồn: isEnrolled (mock data) + purchasedIds (Zustand)
  const purchasedCourses = useMemo(() => {
    const mockEnrolled = MOCK_COURSES.filter(c => c.isEnrolled || purchasedIds.includes(c.id));
    return [...mockEnrolled, ...purchasedRealCourses];
  }, [purchasedIds, purchasedRealCourses]);

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner
        title="Lịch sử mua hàng"
        subtitle={`${purchasedCourses.length} khóa học đã sở hữu`}
      />

      {/* Nội dung full-width — sidebar nằm trong header (click avatar) */}
      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main>

          {/* Tiêu đề section */}
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-on-surface">Khóa học đã mua</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Nhấn vào khóa học để tiếp tục hành trình học tập
            </p>
          </div>

          {/* ── Danh sách hoặc empty state ────────────────────────────────── */}
          {purchasedCourses.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {purchasedCourses.map((course, idx) => (
                // Stagger animation: mỗi card delay thêm 80ms
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, ease: 'easeOut' }}
                  className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 flex gap-4 items-center shadow-sm hover:shadow-md hover:border-primary/25 transition-all group"
                >
                  {/* Thumbnail */}
                  <div className="w-28 flex-shrink-0 rounded-xl overflow-hidden">
                    <img
                      src={course.image}
                      alt={course.title}
                      className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      style={{ height: '72px' }}
                    />
                  </div>

                  {/* Thông tin */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-on-surface text-base line-clamp-1 mb-0.5">
                      {course.title}
                    </h3>
                    <p className="text-sm text-on-surface-variant mb-2">{course.instructor}</p>
                    <div className="flex gap-2">
                      <span className="text-xs bg-surface-container px-2.5 py-0.5 rounded-full text-on-surface-variant font-medium">
                        {course.grade}
                      </span>
                      <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-medium">
                        {course.subject}
                      </span>
                    </div>
                  </div>

                  {/* Giá + nút */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2.5">
                    <span className="text-primary font-extrabold text-base">{course.price}</span>
                    {/* Tiếp tục học → CourseDetailPage sẽ detect isEnrolled và mở LearningView */}
                    <button
                      onClick={() => navigate(`/courses/${course.id}`)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl text-sm font-bold hover:bg-primary/90 hover:-translate-y-0.5 transition-all shadow-sm shadow-primary/20"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Tiếp tục học
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
