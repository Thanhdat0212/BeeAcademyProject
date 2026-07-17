import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { Course } from '../../../data/mockCourses';
import { searchCourses } from '../../../api/courseService';
import { adaptCourseSummary } from '../../../api/adapter';
import { MarketingView } from './MarketingView';
import { SafeCourseImage } from './shared';


// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: MarketingView
//
// Hiển thị khi user CHƯA mua khóa học.
// Mục tiêu: thuyết phục user mua — hero banner, tabs thông tin, sticky purchase card.
//
// LUỒNG THÊM VÀO GIỎ HÀNG:
//   1. User nhấn "Thêm vào giỏ hàng" → handleAddToCart()
//   2. Kiểm tra đăng nhập: chưa → redirect /login với state { from: /courses/:id }
//      Sau khi login xong, Login.tsx sẽ navigate về đúng trang này
//   3. Kiểm tra đã sở hữu: đã mua rồi → toast lỗi, dừng lại
//   4. Hợp lệ → addToCart(course) → toast thành công
//   5. User vào /checkout để thanh toán
//
// 3 TABS:
//   'overview'   — Bạn sẽ học được gì (checklist + mô tả chi tiết)
//   'syllabus'   — Nội dung khóa học (danh sách bài học với icon type)
//   'instructor' — Thông tin giảng viên (avatar + bio)
// ═══════════════════════════════════════════════════════════════════════════════
export function RelatedCourses({
  currentCourseId,
  subjectSlug,
}: {
  currentCourseId?: string;
  subjectSlug?: string;
}) {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRelatedCourses() {
      try {
        // 1 call không filter môn rồi ưu tiên cùng môn phía client — trước đây
        // 2 call tuần tự (cùng môn + fallback) tốn gấp đôi round-trip tới BE.
        const page = await searchCourses({ size: 12, sort: 'rating' });
        const candidates = page.items.filter((item) => item.id !== currentCourseId);
        const sameSubject = subjectSlug
          ? candidates.filter((item) => item.categorySlug === subjectSlug)
          : [];
        const others = candidates.filter((item) => !sameSubject.includes(item));
        const items = [...sameSubject, ...others];

        if (!cancelled) setCourses(items.slice(0, 4).map((item) => adaptCourseSummary(item)));
      } catch {
        if (!cancelled) setCourses([]);
      }
    }

    void loadRelatedCourses();
    return () => { cancelled = true; };
  }, [currentCourseId, subjectSlug]);

  if (courses.length === 0) return null;

  return (
    <section className="max-w-[1200px] mx-auto w-full px-4 md:px-10 pb-20">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-primary">Khám phá thêm</p>
          <h2 className="mt-1 text-2xl font-extrabold text-on-surface">Khóa học liên quan</h2>
        </div>
        <Link to="/courses" className="text-sm font-bold text-primary hover:underline">Xem tất cả</Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {courses.map((related) => (
          <Link
            key={related.id}
            to={`/courses/${related.id}`}
            className="overflow-hidden rounded-3xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
          >
            <SafeCourseImage course={related} className="h-36 w-full object-cover" />
            <div className="p-4">
              <p className="line-clamp-2 font-extrabold text-on-surface">{related.title}</p>
              <p className="mt-2 text-xs text-on-surface-variant">{related.instructor}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-amber-500" /> {related.rating > 0 ? related.rating.toFixed(1) : 'Mới'}
                </span>
                <span className="text-sm font-extrabold text-primary">{related.price}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
