import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { notify } from '../../lib/toast';
import { isApiError } from '../../api/client';
import {
  decideRetakeRequest,
  listRetakeRequests,
  type TeacherRetakeRequest,
} from '../../api/examService';

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RetakeRequestsPanel() {
  const [requests, setRequests] = useState<TeacherRetakeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [extraAttempts, setExtraAttempts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    listRetakeRequests()
      .then(data => {
        if (!cancelled) setRequests(data);
      })
      .catch(err => {
        if (!cancelled) {
          notify.error(isApiError(err) ? err.message : 'Không tải được yêu cầu mở lượt thi.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDecide(request: TeacherRetakeRequest, approve: boolean) {
    const reason = (reasons[request.id] ?? '').trim();
    if (!reason) {
      notify.error('Vui lòng nhập lý do quyết định.');
      return;
    }
    setDecidingId(request.id);
    try {
      await decideRetakeRequest(
        request.id,
        approve,
        reason,
        approve ? (extraAttempts[request.id] ?? 1) : undefined,
      );
      setRequests(prev => prev.filter(item => item.id !== request.id));
      notify.success(approve ? 'Đã duyệt mở thêm lượt.' : 'Đã từ chối yêu cầu.');
    } catch (err) {
      notify.error(isApiError(err) ? err.message : 'Không xử lý được yêu cầu.');
    } finally {
      setDecidingId(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 text-center text-sm text-on-surface-variant">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2 text-primary" />
        Đang tải yêu cầu mở lượt thi...
      </div>
    );
  }

  if (requests.length === 0) return null;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <RotateCcw className="w-5 h-5 text-amber-600" />
        <h2 className="text-base font-bold">
          Yêu cầu mở thêm lượt thi
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600">
            {requests.length} chờ duyệt
          </span>
        </h2>
      </div>
      <div className="space-y-4">
        {requests.map(request => (
          <div
            key={request.id}
            className="border border-outline-variant/30 rounded-xl p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <p className="font-bold text-on-surface text-sm">{request.studentName}</p>
                <p className="text-xs text-on-surface-variant font-medium">
                  {request.courseTitle} · {request.examName} · Đã dùng{' '}
                  {request.attemptsUsed}/{request.maxAttempts} lượt
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Gửi lúc {formatDateTime(request.createdAt)}
                </p>
              </div>
            </div>
            <p className="text-sm text-on-surface bg-surface-container-low rounded-lg px-3 py-2">
              {request.requestedReason}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={reasons[request.id] ?? ''}
                onChange={e => setReasons(prev => ({ ...prev, [request.id]: e.target.value }))}
                placeholder="Lý do quyết định (bắt buộc)..."
                className="flex-1 px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:border-primary"
              />
              <select
                value={extraAttempts[request.id] ?? 1}
                onChange={e => setExtraAttempts(prev => ({
                  ...prev,
                  [request.id]: Number(e.target.value),
                }))}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm font-semibold focus:outline-none appearance-none cursor-pointer"
              >
                <option value={1}>+1 lượt</option>
                <option value={2}>+2 lượt</option>
                <option value={3}>+3 lượt</option>
                <option value={4}>+4 lượt</option>
                <option value={5}>+5 lượt</option>
              </select>
              <button
                onClick={() => handleDecide(request, true)}
                disabled={decidingId === request.id}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Duyệt
              </button>
              <button
                onClick={() => handleDecide(request, false)}
                disabled={decidingId === request.id}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Từ chối
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
