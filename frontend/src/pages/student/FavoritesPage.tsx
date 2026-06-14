// ═══════════════════════════════════════════════════════════════════════════════
// TRANG DANH SÁCH YÊU THÍCH — FavoritesPage.tsx
//
// VỊ TRÍ TRONG HỆ THỐNG:
//   URL: /favorites
//   Người dùng đến từ: Avatar dropdown header (click "Danh sách yêu thích")
//
// NỘI DUNG:
//   Hiển thị các khóa học mà user đã click heart (favoritedIds trong useCourseStore).
//   Mỗi card: thumbnail, badge grade/subject, tên, giảng viên, nút bỏ yêu thích + nút hành động.
//
// TRẠNG THÁI EMPTY:
//   Chưa yêu thích khóa học nào → empty state + nút "Khám phá ngay"
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, BookOpen, PlayCircle, ShoppingCart } from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useCourseStore } from '../../store/useCourseStore';
import { useCartStore } from '../../store/useCartStore';
import { notify } from '../../lib/toast';
import { getCourseDetail } from '../../api/courseService';
import { adaptCourseDetail } from '../../api/adapter';
import type { Course as UiCourse } from '../../data/mockCourses';

export default function FavoritesPage() {
  const navigate = useNavigate();

  // Lấy danh sách ID yêu thích và toggle function từ store
  const favoritedIds   = useCourseStore(state => state.favoritedIds);
  const toggleFavorite = useCourseStore(state => state.toggleFavorite);
  const purchasedIds   = useCourseStore(state => state.purchasedIds);
  const addToCart      = useCartStore(state => state.addToCart);

  const [favoritedCourses, setFavoritedCourses] = useState<UiCourse[]>([]);

  useEffect(() => {
    if (favoritedIds.length === 0) {
      setFavoritedCourses([]);
      return;
    }
    Promise.all(
      favoritedIds.map(id =>
        getCourseDetail(id)
          .then(adaptCourseDetail)
          .catch(() => null)
      )
    ).then(details => {
      setFavoritedCourses(details.filter((d): d is UiCourse => d !== null));
    });
  }, [favoritedIds]);

  function handleAddToCart(course: UiCourse) {
    addToCart({
      id: course.id,
      title: course.title,
      priceVnd: parseInt((course.price ?? '0').replace(/\D/g, '')) || 0,
      image: course.image,
    });
    notify.success(`Đã thêm "${course.title}" vào giỏ hàng`);
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner
        title="Danh sách yêu thích"
        subtitle={`${favoritedCourses.length} khóa học đã yêu thích`}
      />

      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main>

          {/* Tiêu đề section */}
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-on-surface">Khóa học yêu thích</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Các khóa học bạn đã đánh dấu yêu thích
            </p>
          </div>

          {/* ── Empty state ──────────────────────────────────────────────────── */}
          {favoritedCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 border-dashed">
              <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-5">
                <Heart className="w-9 h-9 text-on-surface-variant opacity-40" />
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">Chưa có khóa học yêu thích</h3>
              <p className="text-on-surface-variant text-sm text-center max-w-sm mb-6">
                Nhấn vào icon <Heart className="inline w-3.5 h-3.5 text-red-400 mx-0.5" /> bên dưới tên khóa học để thêm vào danh sách yêu thích.
              </p>
              <button
                onClick={() => navigate('/courses')}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                <BookOpen className="w-4 h-4" />
                Khám phá ngay
              </button>
            </div>

          ) : (
            /* ── Grid khóa học yêu thích ─────────────────────────────────── */
            <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <AnimatePresence>
                {favoritedCourses.map((course, idx) => {
                  const isEnrolled = !!course.isEnrolled || purchasedIds.includes(course.id);

                  return (
                    <motion.div
                      layout
                      key={course.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.25, delay: idx * 0.05 }}
                      className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/25 transition-all group flex flex-col"
                    >
                      {/* Thumbnail */}
                      <div className="relative h-40 overflow-hidden flex-shrink-0">
                        <img
                          src={course.image}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                          onClick={() => navigate(`/courses/${course.id}`)}
                        />
                        {/* Badges grade + subject */}
                        <div className="absolute top-3 left-3 flex gap-1.5 pointer-events-none">
                          <span className="bg-surface/90 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full text-on-surface">
                            {course.grade}
                          </span>
                          <span className="bg-primary/90 text-xs font-bold px-2.5 py-1 rounded-full text-on-primary">
                            {course.subject}
                          </span>
                        </div>
                        {/* Badge "Đã sở hữu" */}
                        {isEnrolled && (
                          <div className="absolute bottom-3 right-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                            Đã sở hữu
                          </div>
                        )}
                      </div>

                      {/* Nội dung card */}
                      <div className="p-4 flex flex-col flex-grow">
                        {/* Tên khóa học */}
                        <h3
                          onClick={() => navigate(`/courses/${course.id}`)}
                          className="font-bold text-on-surface text-sm line-clamp-2 mb-1 cursor-pointer hover:text-primary transition-colors leading-snug"
                        >
                          {course.title}
                        </h3>

                        {/* Nút bỏ yêu thích — bên dưới tên */}
                        <button
                          onClick={() => toggleFavorite(course.id)}
                          className="flex items-center gap-1 mb-2 group/unfav w-fit"
                        >
                          <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500 group-hover/unfav:fill-red-300 group-hover/unfav:text-red-300 transition-colors" />
                          <span className="text-xs font-medium text-red-500 group-hover/unfav:text-red-300 transition-colors">
                            Bỏ yêu thích
                          </span>
                        </button>

                        {/* Giảng viên */}
                        <p className="text-xs text-on-surface-variant mb-3">{course.instructor}</p>

                        {/* Footer: giá + nút hành động */}
                        <div className="mt-auto flex items-center justify-between gap-2">
                          <span className="text-primary font-extrabold text-sm">{course.price}</span>

                          {isEnrolled ? (
                            /* Đã mua → "Tiếp tục học" */
                            <button
                              onClick={() => navigate(`/courses/${course.id}`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              Tiếp tục học
                            </button>
                          ) : (
                            /* Chưa mua → "Thêm vào giỏ" */
                            <button
                              onClick={() => handleAddToCart(course)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant/50 text-on-surface rounded-lg text-xs font-bold hover:bg-primary hover:text-on-primary hover:border-primary transition-all"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              Thêm giỏ hàng
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
