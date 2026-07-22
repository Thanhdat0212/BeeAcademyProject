import type {
  ChildProgressReportResponse,
  ParentAssessmentRecord,
  ParentCertificateRecord,
  ParentCourseProgressItem,
  ParentRequiredExamStatus,
} from '../types/api';

interface PrintOptions {
  filterSummary?: string;
}

function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function courseStatusLabel(status: string): string {
  return status === 'completed' ? 'Đã hoàn thành' : 'Đang học';
}

function requiredExamStatusLabel(status: ParentRequiredExamStatus): string {
  switch (status) {
    case 'not_configured':
      return 'Chưa cấu hình';
    case 'not_submitted':
      return 'Chưa nộp';
    case 'in_progress':
      return 'Đang làm';
    case 'pending_grading':
      return 'Chờ chấm';
    case 'passed':
      return 'Dat';
    case 'failed':
      return 'Chưa đạt';
    default:
      return status;
  }
}

function requiredExamSummary(course: ParentCourseProgressItem): string {
  const requiredExams = course.requiredExams ?? [];
  if (requiredExams.length === 0) {
    return 'Chưa có cấu hình';
  }
  return requiredExams
    .map(exam => {
      const score = exam.normalizedScore != null ? `${exam.normalizedScore.toFixed(1)}/10` : requiredExamStatusLabel(exam.status);
      return `${exam.label}: ${score}`;
    })
    .join('; ');
}

function certificateStatusLabel(status: ParentCertificateRecord['status']): string {
  switch (status) {
    case 'ISSUED':
      return 'Đã cấp';
    case 'REISSUED':
      return 'Đã cấp lại';
    case 'NEEDS_REVIEW':
      return 'Cần xem xét';
    case 'REVOKED':
      return 'Đã thu hồi';
    default:
      return 'Chưa cấp';
  }
}

function progressAccessReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case 'DOB_MISSING_REQUIRE_CONSENT':
      return 'Thiếu ngày sinh học sinh, cần xác nhận đồng ý để xem dữ liệu nhạy cảm.';
    case 'STUDENT_16_PLUS_PRIVACY_ENABLED_REQUIRE_CONSENT':
      return 'Học sinh từ 16 tuổi đang bật quyền riêng tư, cần đồng ý trước khi hiển thị chi tiết nhạy cảm.';
    default:
      return 'Một số nhận xét và chi tiết bài làm đang được ẩn theo thiết lập quyền riêng tư.';
  }
}

function formatScore(record: ParentAssessmentRecord): string {
  if (record.rawScore == null || record.maxScore == null) return '—';
  return `${record.rawScore.toFixed(1)}/${record.maxScore.toFixed(0)}`;
}

function formatNormalizedScore(record: ParentAssessmentRecord): string {
  if (record.normalizedScore == null) return '—';
  return `${record.normalizedScore.toFixed(1)}/10`;
}

function averageScore(report: ChildProgressReportResponse): string {
  const scored = report.assessments.filter(item => item.normalizedScore != null);
  if (scored.length === 0) return '—';
  const avg = scored.reduce((sum, item) => sum + (item.normalizedScore ?? 0), 0) / scored.length;
  return avg.toFixed(1);
}

function averageProgress(report: ChildProgressReportResponse): string {
  if (report.courses.length === 0) return '0.0';
  const avg = report.courses.reduce((sum, item) => sum + item.progressPct, 0) / report.courses.length;
  return avg.toFixed(1);
}

function weeklyTrendLabel(trend: string): string {
  switch (trend) {
    case 'increasing':
      return 'Tăng so với tuần trước';
    case 'decreasing':
      return 'Giảm so với tuần trước';
    case 'stable':
      return 'Ổn định so với tuần trước';
    default:
      return 'Chưa đủ dữ liệu so sánh';
  }
}

export function printParentProgressReport(
  report: ChildProgressReportResponse,
  options: PrintOptions = {},
): boolean {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    return false;
  }

  const totalQuizCompleted = report.courses.reduce((sum, item) => sum + item.quizCompletedCount, 0);
  const totalQuizCount = report.courses.reduce((sum, item) => sum + item.quizTotalCount, 0);
  const filterSummary = options.filterSummary?.trim() || 'Tất cả dữ liệu hiện có';
  const privacyNote = report.sensitiveDataMasked
    ? `<section class="privacy-note"><strong>Dữ liệu nhạy cảm đang được ẩn.</strong><br />${escapeHtml(progressAccessReasonLabel(report.detailAccessReason))}</section>`
    : '';

  const courseRows = report.courses.length === 0
    ? `
      <tr>
        <td colspan="7" class="empty">Không có khóa học phù hợp với bộ lọc.</td>
      </tr>
    `
    : report.courses.map(course => `
      <tr>
        <td>${escapeHtml(course.courseTitle)}</td>
        <td>${escapeHtml(course.teacherName ?? '—')}</td>
        <td>${escapeHtml(course.grades.length > 0 ? `Lớp ${course.grades.join(', ')}` : report.gradeLabel || '—')}</td>
        <td>${course.progressPct}%</td>
        <td>${course.quizCompletedCount}/${course.quizTotalCount}</td>
        <td>${escapeHtml(requiredExamSummary(course))}</td>
        <td>${escapeHtml(courseStatusLabel(course.status))}</td>
      </tr>
    `).join('');

  const completedLessons = report.courses.flatMap(course =>
    (course.completedLessons ?? []).map(lesson => ({ course, lesson })),
  );
  const lessonRows = completedLessons.length === 0
    ? `
      <tr>
        <td colspan="5" class="empty">Chưa có bài học đã hoàn thành.</td>
      </tr>
    `
    : completedLessons.map(({ course, lesson }) => `
      <tr>
        <td>${escapeHtml(course.courseTitle)}</td>
        <td>${escapeHtml(lesson.chapterTitle)}</td>
        <td>${escapeHtml(lesson.lessonTitle)}</td>
        <td>${escapeHtml(lesson.durationSec != null ? `${Math.round(lesson.durationSec / 60)} phút` : '---')}</td>
        <td>${escapeHtml(formatDateTime(lesson.completedAt))}</td>
      </tr>
    `).join('');

  const assessmentRows = report.assessments.length === 0
    ? `
      <tr>
        <td colspan="6" class="empty">Không có cột điểm phù hợp với bộ lọc.</td>
      </tr>
    `
    : report.assessments.map(record => `
      <tr>
        <td>${formatDateTime(record.submittedAt)}</td>
        <td>${escapeHtml(record.courseTitle)}</td>
        <td>${escapeHtml(record.assessmentName)}</td>
        <td>${escapeHtml(record.assessmentType.toUpperCase())}</td>
        <td>${escapeHtml(formatScore(record))}</td>
        <td>${escapeHtml(formatNormalizedScore(record))}</td>
      </tr>
    `).join('');

  const certificates = report.certificates ?? [];
  const certificateRows = certificates.length === 0
    ? `
      <tr>
        <td colspan="6" class="empty">Chưa có chứng chỉ nào.</td>
      </tr>
    `
    : certificates.map(certificate => `
      <tr>
        <td>${escapeHtml(certificate.courseTitle)}</td>
        <td>${escapeHtml(certificate.teacherName ?? '-')}</td>
        <td>${escapeHtml(certificateStatusLabel(certificate.status))}</td>
        <td>${escapeHtml(certificate.certificateNo)}</td>
        <td>${escapeHtml(certificate.verificationCode)}</td>
        <td>${escapeHtml(formatDateTime(certificate.issuedAt))}</td>
      </tr>
    `).join('');

  const html = `<!doctype html>
  <html lang="vi">
    <head>
      <meta charset="utf-8" />
      <title>Báo cáo tiến độ học tập</title>
      <style>
        :root {
          color-scheme: light;
          --ink: #16202a;
          --muted: #5f6b76;
          --line: #d8e0e6;
          --panel: #f5f8fa;
          --accent: #a63b00;
          --accent-soft: #fff1ea;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "Segoe UI", Arial, sans-serif;
          color: var(--ink);
          background: white;
        }
        .page {
          width: 100%;
          max-width: 980px;
          margin: 0 auto;
          padding: 40px 36px 56px;
        }
        .hero {
          border: 1px solid var(--line);
          background: linear-gradient(135deg, #fff7f1 0%, #ffffff 60%);
          border-radius: 20px;
          padding: 24px 28px;
          margin-bottom: 24px;
        }
        .eyebrow {
          margin: 0 0 6px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent);
        }
        h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
        }
        .hero p {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.5;
        }
        .meta {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 24px 0;
        }
        .meta-card {
          border: 1px solid var(--line);
          background: var(--panel);
          border-radius: 16px;
          padding: 16px;
        }
        .meta-card span {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          margin-bottom: 8px;
          font-weight: 700;
        }
        .meta-card strong {
          font-size: 24px;
          line-height: 1.1;
        }
        .section {
          margin-top: 28px;
        }
        .section h2 {
          margin: 0 0 8px;
          font-size: 18px;
        }
        .section p {
          margin: 0 0 14px;
          color: var(--muted);
          font-size: 13px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid var(--line);
          border-radius: 14px;
          overflow: hidden;
        }
        thead th {
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          text-align: left;
          padding: 12px 14px;
        }
        tbody td {
          border-top: 1px solid var(--line);
          padding: 12px 14px;
          font-size: 13px;
          vertical-align: top;
        }
        .empty {
          text-align: center;
          color: var(--muted);
          padding: 20px;
        }
        .privacy-note {
          border: 1px solid #f1c56d;
          background: #fff8e5;
          color: #7a4b00;
          border-radius: 14px;
          padding: 14px 16px;
          margin: 20px 0 0;
          font-size: 13px;
          line-height: 1.45;
        }
        .footer {
          margin-top: 24px;
          font-size: 12px;
          color: var(--muted);
        }
        @media print {
          .page {
            max-width: none;
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <section class="hero">
          <p class="eyebrow">Bee Academy Parent Report</p>
          <h1>Báo cáo tiến độ học tập</h1>
          <p>Học sinh: ${escapeHtml(report.studentName)}${report.gradeLabel ? ` · ${escapeHtml(report.gradeLabel)}` : ''}</p>
          <p>Bộ lọc: ${escapeHtml(filterSummary)}</p>
          <p>Tạo lúc: ${escapeHtml(formatDateTime(report.generatedAt))}</p>
        </section>
        ${privacyNote}

        <section class="meta">
          <div class="meta-card">
            <span>Khóa học</span>
            <strong>${report.courses.length}</strong>
          </div>
          <div class="meta-card">
            <span>Tiến độ TB</span>
            <strong>${averageProgress(report)}%</strong>
          </div>
          <div class="meta-card">
            <span>Điểm TB</span>
            <strong>${averageScore(report)}</strong>
          </div>
          <div class="meta-card">
            <span>Quiz đã làm</span>
            <strong>${totalQuizCompleted}/${totalQuizCount}</strong>
          </div>
        </section>

        <section class="section">
          <h2>Tiến độ theo khóa học</h2>
          <p>Danh sách các khóa học mà học sinh đang theo học và mức độ hoàn thành hiện tại.</p>
          <table>
            <thead>
              <tr>
                <th>Khóa học</th>
                <th>Giáo viên</th>
                <th>Khối lớp</th>
                <th>Tiến độ</th>
                <th>Quiz</th>
                <th>4 bai kiem tra</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>${courseRows}</tbody>
          </table>
        </section>

        <section class="section">
          <h2>Báo cáo 7 ngày</h2>
          <p>${escapeHtml(report.weeklySummary.periodStart)} đến ${escapeHtml(report.weeklySummary.periodEnd)} · ${escapeHtml(weeklyTrendLabel(report.weeklySummary.progressTrend))}</p>
          <table>
            <thead>
              <tr>
                <th>Hoàn thành tuần này</th>
                <th>Tuần trước</th>
                <th>Điểm trung bình</th>
                <th>Bài chưa hoàn thành</th>
                <th>Ngày không học</th>
                <th>Khuyến nghị</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${report.weeklySummary.currentWeekCompletedItems}</td>
                <td>${report.weeklySummary.previousWeekCompletedItems}</td>
                <td>${report.weeklySummary.averageScore == null ? '---' : `${report.weeklySummary.averageScore.toFixed(1)}/10`}</td>
                <td>${report.weeklySummary.incompleteLearningItems}</td>
                <td>${report.weeklySummary.inactiveDays}/7</td>
                <td>${escapeHtml(report.weeklySummary.actionSuggestion)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="section">
          <h2>Bài đã học</h2>
          <p>Các bài học đã được ghi nhận hoàn thành trong từng khóa học.</p>
          <table>
            <thead>
              <tr>
                <th>Khóa học</th>
                <th>Chương</th>
                <th>Bài học</th>
                <th>Thời lượng</th>
                <th>Hoàn thành lúc</th>
              </tr>
            </thead>
            <tbody>${lessonRows}</tbody>
          </table>
        </section>

        <section class="section">
          <h2>Bảng điểm gần đây</h2>
          <p>Các cột điểm quiz, exam và assignment được ghi nhận theo thứ tự mới nhất.</p>
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Khóa học</th>
                <th>Bài đánh giá</th>
                <th>Loại</th>
                <th>Điểm gốc</th>
                <th>Quy doi</th>
              </tr>
            </thead>
            <tbody>${assessmentRows}</tbody>
          </table>
        </section>

        <section class="section">
          <h2>Chứng chỉ</h2>
          <p>Trạng thái chứng chỉ của học sinh theo từng khóa học.</p>
          <table>
            <thead>
              <tr>
                <th>Khóa học</th>
                <th>Giáo viên</th>
                <th>Trạng thái</th>
                <th>Số chứng chỉ</th>
                <th>Mã xác thực</th>
                <th>Ngày cấp</th>
              </tr>
            </thead>
            <tbody>${certificateRows}</tbody>
          </table>
        </section>

        <p class="footer">Báo cáo được xuất từ Parent Portal của Bee Academy.</p>
      </div>
    </body>
  </html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => {
    printWindow.print();
  }, 250);
  return true;
}
