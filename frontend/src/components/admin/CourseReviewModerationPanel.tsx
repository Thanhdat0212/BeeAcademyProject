import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RefreshCw, ShieldCheck, Star, X } from 'lucide-react';
import {
  listPendingCourseReviews,
  moderateCourseReview,
} from '../../api/adminCourseReviewService';
import type { CourseReview } from '../../types/api';
import { notify } from '../../lib/toast';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CourseReviewModerationPanel() {
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReviews(await listPendingCourseReviews());
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được đánh giá chờ duyệt.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi');
    if (!keyword) return reviews;
    return reviews.filter(review => [
      review.studentName,
      review.courseTitle,
      review.comment,
    ].some(value => value?.toLocaleLowerCase('vi').includes(keyword)));
  }, [query, reviews]);

  async function decide(review: CourseReview, decision: 'APPROVE' | 'REJECT') {
    const reason = reasons[review.id]?.trim() ?? '';
    if (decision === 'REJECT' && !reason) {
      notify.error('Vui lòng nhập lý do từ chối để học sinh có thể chỉnh sửa.');
      return;
    }
    setActingId(review.id);
    try {
      await moderateCourseReview(review.id, decision, reason);
      setReviews(current => current.filter(item => item.id !== review.id));
      notify.success(decision === 'APPROVE' ? 'Đã công khai đánh giá.' : 'Đã từ chối đánh giá.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không cập nhật được đánh giá.');
    } finally {
      setActingId(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-on-surface">
              <ShieldCheck className="h-5 w-5 text-primary" /> Kiểm duyệt đánh giá khóa học
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Chỉ đánh giá bị bộ lọc nội dung gắn cờ mới xuất hiện tại đây.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold hover:bg-surface-container disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Làm mới
          </button>
        </div>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Tìm theo học sinh, khóa học hoặc nội dung..."
          className="mt-4 w-full rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {loading && reviews.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest p-10 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-green-600" />
          <p className="mt-3 font-extrabold">Không có đánh giá chờ duyệt</p>
          <p className="mt-1 text-sm text-on-surface-variant">Hàng đợi kiểm duyệt hiện đã được xử lý hết.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(review => (
            <article key={review.id} className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-extrabold text-on-surface">{review.studentName || 'Học sinh'}</p>
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                    {review.courseTitle || `Khóa học ${review.courseId}`} · {formatDateTime(review.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-extrabold text-amber-700">
                  <Star className="h-4 w-4 fill-current" /> {review.rating}/5
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm leading-6 text-on-surface">
                {review.comment}
              </p>
              <label className="mt-4 block text-xs font-bold uppercase text-on-surface-variant" htmlFor={`moderation-reason-${review.id}`}>
                Ghi chú kiểm duyệt
              </label>
              <textarea
                id={`moderation-reason-${review.id}`}
                value={reasons[review.id] ?? ''}
                onChange={event => setReasons(current => ({ ...current, [review.id]: event.target.value }))}
                maxLength={500}
                rows={2}
                placeholder="Bắt buộc khi từ chối; tùy chọn khi phê duyệt."
                className="mt-2 w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void decide(review, 'REJECT')}
                  disabled={actingId !== null}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {actingId === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Từ chối
                </button>
                <button
                  type="button"
                  onClick={() => void decide(review, 'APPROVE')}
                  disabled={actingId !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {actingId === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Công khai
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
