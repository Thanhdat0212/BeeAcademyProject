import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import {
  getCertificate,
  listMyCertificates,
  requestCourseCertificate,
  type CertificateResponse,
  type CertificateStatus,
} from '../../api/certificateService';
import { getStudentLearningProgress, type LearningCourseProgress } from '../../api/courseProgressService';
import { notify } from '../../lib/toast';

function statusLabel(status: CertificateStatus): string {
  switch (status) {
    case 'ISSUED':
      return 'Đã cấp';
    case 'REISSUED':
      return 'Đã cấp lại';
    case 'NEEDS_REVIEW':
      return 'Cần rà soát';
    case 'REVOKED':
      return 'Đã thu hồi';
    default:
      return 'Chưa cấp';
  }
}

function statusClass(status: CertificateStatus): string {
  switch (status) {
    case 'ISSUED':
    case 'REISSUED':
      return 'bg-green-500/10 text-green-700';
    case 'NEEDS_REVIEW':
      return 'bg-amber-500/10 text-amber-700';
    case 'REVOKED':
      return 'bg-red-500/10 text-red-700';
    default:
      return 'bg-surface-container text-on-surface-variant';
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateResponse[]>([]);
  const [courses, setCourses] = useState<LearningCourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  const [busyCertificateId, setBusyCertificateId] = useState<string | null>(null);
  const [retryBlockedCourseId, setRetryBlockedCourseId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [certificateData, progressData] = await Promise.all([
        listMyCertificates(),
        getStudentLearningProgress(),
      ]);
      setCertificates(certificateData);
      setCourses(progressData.courses);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tải được chứng chỉ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const certificateByCourse = useMemo(() => {
    const map = new Map<string, CertificateResponse>();
    certificates.forEach(certificate => map.set(certificate.courseId, certificate));
    return map;
  }, [certificates]);

  const certificateCourses = courses;

  async function handleIssue(course: LearningCourseProgress) {
    setBusyCourseId(course.courseId);
    try {
      const certificate = await requestCourseCertificate(course.courseId);
      setCertificates(prev => {
        const others = prev.filter(item => item.id !== certificate.id && item.courseId !== certificate.courseId);
        return [certificate, ...others];
      });
      setRetryBlockedCourseId(null);
      notify.success('Đã cấp chứng chỉ khóa học.');
    } catch (error) {
      setRetryBlockedCourseId(course.courseId);
      window.setTimeout(() => {
        setRetryBlockedCourseId(current => current === course.courseId ? null : current);
      }, 30_000);
      notify.error(error instanceof Error ? error.message : 'Chưa đủ điều kiện cấp chứng chỉ');
    } finally {
      setBusyCourseId(null);
    }
  }

  async function handleOpenPdf(certificate: CertificateResponse, action: 'view' | 'download') {
    setBusyCertificateId(certificate.id);
    try {
      const detail = await getCertificate(certificate.id);
      const url = action === 'view' ? detail.viewUrl : detail.downloadUrl;
      if (!url) {
        notify.error('Chứng chỉ chưa có file PDF khả dụng.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Không tạo được liên kết chứng chỉ');
    } finally {
      setBusyCertificateId(null);
    }
  }

  async function handleShare(certificate: CertificateResponse) {
    const verificationUrl = `${window.location.origin}/certificates/verify/${certificate.verificationCode}`;
    try {
      await navigator.clipboard.writeText(verificationUrl);
      notify.success('Đã sao chép liên kết xác minh công khai.');
    } catch {
      notify.error('Không thể sao chép liên kết xác minh.');
    }
  }

  return (
    <div className="min-h-screen bg-surface font-sans">
      <DashboardHeader />
      <PageBanner
        title="Chứng chỉ"
        subtitle="Xem, cấp và tải chứng chỉ hoàn thành khóa học"
      />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-on-surface">Chứng chỉ của tôi</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Điều kiện cấp: hoàn thành 100% khóa học và đạt bài kiểm tra cuối kỳ 2.
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
            <section className="space-y-4">
              <h2 className="text-lg font-extrabold text-on-surface">Điều kiện chứng chỉ theo khóa học</h2>
              {certificateCourses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest p-8 text-center">
                  <Award className="mx-auto mb-3 h-12 w-12 text-on-surface-variant/45" />
                  <p className="font-semibold text-on-surface-variant">
                    Chưa có khóa học đã mua để kiểm tra điều kiện chứng chỉ.
                  </p>
                </div>
              ) : (
                certificateCourses.map(course => {
                  const certificate = certificateByCourse.get(course.courseId);
                  const canDownload = certificate?.status === 'ISSUED' || certificate?.status === 'REISSUED';
                  const eligibleForCertificate = course.progressPct >= 100 && course.finalExamPassed === true;

                  return (
                    <article
                      key={course.courseId}
                      className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-5 shadow-sm"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase text-primary">{course.categoryName ?? 'Khóa học'}</p>
                          <h3 className="mt-1 text-lg font-extrabold text-on-surface">{course.title}</h3>
                          <p className="mt-1 text-sm text-on-surface-variant">
                            Giáo viên: {course.teacherName ?? 'Đang cập nhật'} · Tiến độ {course.progressPct}%
                          </p>
                          <p className={`mt-1 text-xs font-semibold ${course.finalExamPassed ? 'text-green-700' : 'text-amber-700'}`}>
                            Final exam: {course.finalExamPassed ? 'Đã đạt' : 'Chưa đạt hoặc chưa có kết quả'}
                          </p>
                          {certificate && (
                            <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(certificate.status)}`}>
                              {canDownload ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                              {statusLabel(certificate.status)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canDownload && certificate ? (
                            <>
                            <button
                              type="button"
                              onClick={() => handleOpenPdf(certificate, 'view')}
                              disabled={busyCertificateId === certificate.id}
                              className="inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 disabled:opacity-60"
                            >
                              <ExternalLink className="h-4 w-4" /> Xem PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPdf(certificate, 'download')}
                              disabled={busyCertificateId === certificate.id}
                              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-60"
                            >
                              {busyCertificateId === certificate.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                              Tải PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShare(certificate)}
                              className="inline-flex items-center rounded-xl border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface"
                            >
                              Chia sẻ
                            </button>
                            </>
                          ) : eligibleForCertificate && !certificate ? (
                            <button
                              type="button"
                              onClick={() => handleIssue(course)}
                              disabled={busyCourseId === course.courseId || retryBlockedCourseId === course.courseId}
                              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-60"
                            >
                              {busyCourseId === course.courseId ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
                              {retryBlockedCourseId === course.courseId ? 'Thử lại sau 30 giây' : 'Cấp chứng chỉ'}
                            </button>
                          ) : certificate ? (
                            <p className="max-w-xs self-center text-xs font-semibold text-amber-700">
                              {certificate.status === 'NEEDS_REVIEW'
                                ? 'Chứng chỉ đang được rà soát do kết quả học tập đã thay đổi.'
                                : 'Chứng chỉ đã bị thu hồi và không còn hiệu lực.'}
                            </p>
                          ) : (
                            <p className="max-w-xs self-center text-xs font-semibold text-amber-700">
                              Hoàn thành 100% nội dung và đạt final exam để xem chứng chỉ.
                            </p>
                          )}
                          <Link
                            to={`/courses/${course.courseId}`}
                            className="inline-flex items-center rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface"
                          >
                            Xem khóa học
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </section>

            <section>
              <h2 className="mb-4 text-lg font-extrabold text-on-surface">Lịch sử chứng chỉ</h2>
              {certificates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container-lowest p-8 text-center">
                  <FileCheck2 className="mx-auto mb-3 h-12 w-12 text-on-surface-variant/45" />
                  <p className="font-semibold text-on-surface-variant">Bạn chưa có chứng chỉ nào.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {certificates.map(certificate => (
                    <article
                      key={certificate.id}
                      className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-extrabold text-on-surface">{certificate.courseTitle}</h3>
                          <p className="mt-1 text-sm font-semibold text-primary">{certificate.certificateNo}</p>
                        </div>
                        <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(certificate.status)}`}>
                          {certificate.status === 'REVOKED' ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {statusLabel(certificate.status)}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-on-surface-variant">
                        Cấp ngày {formatDate(certificate.issuedAt)} · Phiên bản {certificate.versionNo}
                      </p>
                      {certificate.reviewNote && (
                        <p className="mt-2 text-xs font-medium text-amber-700">{certificate.reviewNote}</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
