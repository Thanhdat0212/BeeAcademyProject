import {
  Loader2,
  MessageSquare,
  Send,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { isApiError } from '../../../api/client';
import { getCourseProgress } from '../../../api/courseProgressService';
import {
  getCourseReviews,
  upsertCourseReview,
} from '../../../api/courseService';
import { notify } from '../../../lib/toast';
import type { CourseReviewSummary } from '../../../types/api';
import { renderReviewStars } from './courseDetailUtils';

export default function CourseReviewsPanel({
  courseId,
  fallbackRating,
  fallbackReviewCount,
  canSubmitReview,
  isOwnedCourse,
  progressPct,
}: {
  courseId: string;
  fallbackRating: number;
  fallbackReviewCount: number;
  canSubmitReview: boolean;
  isOwnedCourse: boolean;
  progressPct: number;
}) {
  const [reviewSummary, setReviewSummary] = useState<CourseReviewSummary | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [savingReview, setSavingReview] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const [serverProgressPct, setServerProgressPct] = useState<number | null>(null);
  const effectiveProgressPct = serverProgressPct ?? progressPct;
  const canWriteReview = canSubmitReview && (effectiveProgressPct >= 30 || Boolean(reviewSummary?.myReview));

  const visibleReviews = useMemo(() => {
    const myReviewId = reviewSummary?.myReview?.id;
    return (reviewSummary?.reviews ?? []).filter(review => review.id !== myReviewId);
  }, [reviewSummary]);
  const derivedReviews = useMemo(() => {
    const items = reviewSummary?.myReview
      ? [reviewSummary.myReview, ...visibleReviews]
      : visibleReviews;
    const seen = new Set<string>();
    return items.filter((review) => {
      if (seen.has(review.id)) {
        return false;
      }
      seen.add(review.id);
      return true;
    });
  }, [reviewSummary, visibleReviews]);
  const derivedReviewCount = derivedReviews.length;
  const derivedAverageRating = derivedReviewCount > 0
    ? Math.round(
      (derivedReviews.reduce((sum, review) => sum + review.rating, 0) / derivedReviewCount) * 10,
    ) / 10
    : 0;
  const displayReviewCount =
    (reviewSummary?.reviewCount ?? 0) > 0
      ? (reviewSummary?.reviewCount ?? 0)
      : derivedReviewCount > 0
        ? derivedReviewCount
        : fallbackReviewCount;
  const displayRating =
    (reviewSummary?.reviewCount ?? 0) > 0 && (reviewSummary?.averageRating ?? 0) > 0
      ? (reviewSummary?.averageRating ?? 0)
      : derivedReviewCount > 0
        ? derivedAverageRating
        : fallbackRating;

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
      setLoadingReviews(true);
      try {
        const data = await getCourseReviews(courseId);
        if (cancelled) return;
        setReviewSummary(data);
        setDraftRating(data.myReview?.rating ?? 0);
        setDraftComment(data.myReview?.comment ?? '');
      } catch (error) {
        if (!cancelled) {
          notify.error(isApiError(error) ? error.message : 'Không tải được đánh giá khóa học.');
        }
      } finally {
        if (!cancelled) {
          setLoadingReviews(false);
        }
      }
    }

    loadReviews();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!canSubmitReview) {
      setServerProgressPct(null);
      return;
    }
    let cancelled = false;
    getCourseProgress(courseId)
      .then(progress => {
        if (!cancelled) setServerProgressPct(progress.progressPct);
      })
      .catch(() => {
        if (!cancelled) setServerProgressPct(null);
      });
    return () => {
      cancelled = true;
    };
  }, [canSubmitReview, courseId]);

  async function handleSubmitReview() {
    if (!canSubmitReview) {
      notify.error('Chỉ học sinh đã mua khóa học mới có thể đánh giá.');
      return;
    }
    if (effectiveProgressPct < 30 && !reviewSummary?.myReview) {
      notify.error('Bạn cần hoàn thành ít nhất 30% nội dung khóa học trước khi đánh giá.');
      return;
    }
    if (draftRating < 1 || draftRating > 5) {
      notify.error('Vui lòng chọn số sao đánh giá từ 1 đến 5.');
      return;
    }

    if (draftComment.trim().length < 20) {
      notify.error('Nhận xét cần có ít nhất 20 ký tự.');
      return;
    }

    setSavingReview(true);
    try {
      await upsertCourseReview(courseId, {
        rating: draftRating,
        comment: draftComment,
      });
      const refreshed = await getCourseReviews(courseId);
      setReviewSummary(refreshed);
      setDraftRating(refreshed.myReview?.rating ?? draftRating);
      setDraftComment(refreshed.myReview?.comment ?? draftComment);
      notify.success(refreshed.myReview ? 'Đã lưu đánh giá khóa học.' : 'Đã gửi đánh giá khóa học.');
    } catch (error) {
      notify.error(isApiError(error) ? error.message : 'Không thể lưu đánh giá lúc này.');
    } finally {
      setSavingReview(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-outline-variant/30 bg-surface-container p-6 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-on-surface-variant">Điểm đánh giá</p>
          <p className="mt-3 text-5xl font-extrabold text-on-surface">
            {displayRating > 0 ? displayRating.toFixed(1) : '0.0'}
          </p>
          <div className="mt-3 flex justify-center">
            {renderReviewStars(Math.round(displayRating))}
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">
            {displayReviewCount.toLocaleString('vi-VN')} học viên đã đánh giá
          </p>
        </div>

        <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-low p-6">
          <div className="flex items-start gap-4">
            <div>
              <h2 className="text-2xl font-bold text-on-surface">Cảm nhận từ học viên</h2>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                Đánh giá công khai giúp học viên khác hiểu rõ hơn về chất lượng nội dung, cách giảng dạy và mức độ phù hợp của khóa học.
              </p>
            </div>
          </div>
        </div>
      </div>

      {canWriteReview && (
        <section className="rounded-3xl border border-primary/15 bg-primary/5 p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-extrabold text-on-surface">
                {reviewSummary?.myReview ? 'Cập nhật đánh giá của bạn' : 'Viết đánh giá khóa học'}
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Chia sẻ cảm nhận thực tế sau khi học để giúp Bee Academy cải thiện nội dung tốt hơn.
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-on-surface">Số sao đánh giá</p>
              {renderReviewStars(draftRating, true, setDraftRating)}
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-on-surface">Nhận xét</span>
              <textarea
                value={draftComment}
                onChange={event => setDraftComment(event.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Điều bạn thích nhất ở khóa học là gì? Nội dung, cách giảng dạy hoặc phần nào cần cải thiện?"
                className="w-full rounded-2xl border border-outline-variant/40 bg-surface px-4 py-3 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary"
              />
              <span className="mt-1 block text-right text-xs text-on-surface-variant">
                {draftComment.length}/1000
              </span>
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={savingReview}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-extrabold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {savingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {reviewSummary?.myReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
              </button>
            </div>
          </div>
        </section>
      )}

      {canSubmitReview && !canWriteReview && isOwnedCourse && (
        <section className="rounded-3xl border border-amber-400/30 bg-amber-50 p-5">
          <p className="text-sm text-amber-900">
            Hoàn thành ít nhất 30% nội dung khóa học để viết đánh giá. Tiến độ hiện tại: {Math.max(0, Math.round(effectiveProgressPct))}%.
          </p>
        </section>
      )}

      {!canSubmitReview && isOwnedCourse && (
        <section className="rounded-3xl border border-outline-variant/30 bg-surface-container p-5">
          <p className="text-sm text-on-surface-variant">
            Tài khoản hiện tại không phải học sinh, nên không thể gửi đánh giá cho khóa học này.
          </p>
        </section>
      )}

      {!isOwnedCourse && (
        <section className="rounded-3xl border border-dashed border-outline-variant/40 bg-surface-container p-5">
          <p className="text-sm text-on-surface-variant">
            Bạn có thể xem đánh giá công khai ngay bây giờ. Để tự viết review, hãy mua khóa học và học bằng tài khoản học sinh.
          </p>
        </section>
      )}

      <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-on-surface">Đánh giá gần đây</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Hiển thị những nhận xét mới nhất từ học viên đã tham gia khóa học.
            </p>
          </div>
        </div>

        {loadingReviews ? (
          <div className="flex justify-center py-12 text-on-surface-variant">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : visibleReviews.length === 0 && !reviewSummary?.myReview ? (
          <div className="rounded-3xl border border-dashed border-outline-variant/40 bg-surface-container p-8 text-center">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-on-surface-variant/40" />
            <p className="font-bold text-on-surface">Chưa có đánh giá nào</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Hãy trở thành người đầu tiên chia sẻ trải nghiệm của bạn về khóa học này.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviewSummary?.myReview && (
              <article className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={reviewSummary.myReview.studentAvatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewSummary.myReview.studentName ?? 'Bạn')}&background=feb700&color=1f2937&bold=true`}
                      alt={reviewSummary.myReview.studentName ?? 'Bạn'}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-extrabold text-on-surface">
                        {reviewSummary.myReview.studentName ?? 'Bạn'}
                      </p>
                      <p className="text-xs font-semibold text-primary">Đánh giá của bạn</p>
                      {reviewSummary.myReview.moderationStatus === 'PENDING_MODERATION' && (
                        <p className="mt-1 text-xs font-semibold text-amber-700">Đang chờ Admin kiểm duyệt</p>
                      )}
                      {reviewSummary.myReview.moderationStatus === 'REJECTED' && (
                        <p className="mt-1 text-xs font-semibold text-red-600">Chưa được hiển thị công khai</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {renderReviewStars(reviewSummary.myReview.rating)}
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {new Date(reviewSummary.myReview.updatedAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
                {reviewSummary.myReview.comment && (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
                    {reviewSummary.myReview.comment}
                  </p>
                )}
              </article>
            )}

            {visibleReviews.map(review => (
              <article key={review.id} className="rounded-3xl border border-outline-variant/25 bg-surface p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={review.studentAvatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(review.studentName ?? 'Học viên')}&background=e5e7eb&color=111827&bold=true`}
                      alt={review.studentName ?? 'Học viên'}
                      className="h-11 w-11 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-bold text-on-surface">{review.studentName ?? 'Học viên Bee Academy'}</p>
                      <p className="text-xs text-on-surface-variant">
                        {new Date(review.updatedAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  {renderReviewStars(review.rating)}
                </div>
                {review.comment && (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
                    {review.comment}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
