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
  return status === 'completed' ? 'Da hoan thanh' : 'Dang hoc';
}

function requiredExamStatusLabel(status: ParentRequiredExamStatus): string {
  switch (status) {
    case 'not_configured':
      return 'Chua cau hinh';
    case 'not_submitted':
      return 'Chua nop';
    case 'in_progress':
      return 'Dang lam';
    case 'pending_grading':
      return 'Cho cham';
    case 'passed':
      return 'Dat';
    case 'failed':
      return 'Chua dat';
    default:
      return status;
  }
}

function requiredExamSummary(course: ParentCourseProgressItem): string {
  const requiredExams = course.requiredExams ?? [];
  if (requiredExams.length === 0) {
    return 'Chua co cau hinh';
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
      return 'Da cap';
    case 'REISSUED':
      return 'Da cap lai';
    case 'NEEDS_REVIEW':
      return 'Can xem xet';
    case 'REVOKED':
      return 'Da thu hoi';
    default:
      return 'Chua cap';
  }
}

function progressAccessReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case 'DOB_MISSING_REQUIRE_CONSENT':
      return 'Thieu ngay sinh hoc sinh, can xac nhan dong y de xem du lieu nhay cam.';
    case 'STUDENT_16_PLUS_PRIVACY_ENABLED_REQUIRE_CONSENT':
      return 'Hoc sinh tu 16 tuoi dang bat quyen rieng tu, can dong y truoc khi hien thi chi tiet nhay cam.';
    default:
      return 'Mot so nhan xet va chi tiet bai lam dang duoc an theo thiet lap quyen rieng tu.';
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
      return 'Tang so voi tuan truoc';
    case 'decreasing':
      return 'Giam so voi tuan truoc';
    case 'stable':
      return 'On dinh so voi tuan truoc';
    default:
      return 'Chua du du lieu so sanh';
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
  const filterSummary = options.filterSummary?.trim() || 'Tat ca du lieu hien co';
  const privacyNote = report.sensitiveDataMasked
    ? `<section class="privacy-note"><strong>Du lieu nhay cam dang duoc an.</strong><br />${escapeHtml(progressAccessReasonLabel(report.detailAccessReason))}</section>`
    : '';

  const courseRows = report.courses.length === 0
    ? `
      <tr>
        <td colspan="7" class="empty">Khong co khoa hoc phu hop voi bo loc.</td>
      </tr>
    `
    : report.courses.map(course => `
      <tr>
        <td>${escapeHtml(course.courseTitle)}</td>
        <td>${escapeHtml(course.teacherName ?? '—')}</td>
        <td>${escapeHtml(course.grades.length > 0 ? `Lop ${course.grades.join(', ')}` : report.gradeLabel || '—')}</td>
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
        <td colspan="5" class="empty">Chua co bai hoc da hoan thanh.</td>
      </tr>
    `
    : completedLessons.map(({ course, lesson }) => `
      <tr>
        <td>${escapeHtml(course.courseTitle)}</td>
        <td>${escapeHtml(lesson.chapterTitle)}</td>
        <td>${escapeHtml(lesson.lessonTitle)}</td>
        <td>${escapeHtml(lesson.durationSec != null ? `${Math.round(lesson.durationSec / 60)} phut` : '---')}</td>
        <td>${escapeHtml(formatDateTime(lesson.completedAt))}</td>
      </tr>
    `).join('');

  const assessmentRows = report.assessments.length === 0
    ? `
      <tr>
        <td colspan="6" class="empty">Khong co cot diem phu hop voi bo loc.</td>
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
        <td colspan="6" class="empty">Chua co chung chi nao.</td>
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
      <title>Bao cao tien do hoc tap</title>
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
          <h1>Bao cao tien do hoc tap</h1>
          <p>Hoc sinh: ${escapeHtml(report.studentName)}${report.gradeLabel ? ` · ${escapeHtml(report.gradeLabel)}` : ''}</p>
          <p>Bo loc: ${escapeHtml(filterSummary)}</p>
          <p>Tao luc: ${escapeHtml(formatDateTime(report.generatedAt))}</p>
        </section>
        ${privacyNote}

        <section class="meta">
          <div class="meta-card">
            <span>Khoa hoc</span>
            <strong>${report.courses.length}</strong>
          </div>
          <div class="meta-card">
            <span>Tien do TB</span>
            <strong>${averageProgress(report)}%</strong>
          </div>
          <div class="meta-card">
            <span>Diem TB</span>
            <strong>${averageScore(report)}</strong>
          </div>
          <div class="meta-card">
            <span>Quiz da lam</span>
            <strong>${totalQuizCompleted}/${totalQuizCount}</strong>
          </div>
        </section>

        <section class="section">
          <h2>Tien do theo khoa hoc</h2>
          <p>Danh sach cac khoa hoc ma hoc sinh dang theo hoc va muc do hoan thanh hien tai.</p>
          <table>
            <thead>
              <tr>
                <th>Khoa hoc</th>
                <th>Giao vien</th>
                <th>Khoi lop</th>
                <th>Tien do</th>
                <th>Quiz</th>
                <th>4 bai kiem tra</th>
                <th>Trang thai</th>
              </tr>
            </thead>
            <tbody>${courseRows}</tbody>
          </table>
        </section>

        <section class="section">
          <h2>Bao cao 7 ngay</h2>
          <p>${escapeHtml(report.weeklySummary.periodStart)} den ${escapeHtml(report.weeklySummary.periodEnd)} · ${escapeHtml(weeklyTrendLabel(report.weeklySummary.progressTrend))}</p>
          <table>
            <thead>
              <tr>
                <th>Hoan thanh tuan nay</th>
                <th>Tuan truoc</th>
                <th>Diem trung binh</th>
                <th>Bai chua hoan thanh</th>
                <th>Ngay khong hoc</th>
                <th>Khuyen nghi</th>
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
          <h2>Bai da hoc</h2>
          <p>Cac bai hoc da duoc ghi nhan hoan thanh trong tung khoa hoc.</p>
          <table>
            <thead>
              <tr>
                <th>Khoa hoc</th>
                <th>Chuong</th>
                <th>Bai hoc</th>
                <th>Thoi luong</th>
                <th>Hoan thanh luc</th>
              </tr>
            </thead>
            <tbody>${lessonRows}</tbody>
          </table>
        </section>

        <section class="section">
          <h2>Bang diem gan day</h2>
          <p>Cac cot diem quiz, exam va assignment duoc ghi nhan theo thu tu moi nhat.</p>
          <table>
            <thead>
              <tr>
                <th>Thoi gian</th>
                <th>Khoa hoc</th>
                <th>Bai danh gia</th>
                <th>Loai</th>
                <th>Diem goc</th>
                <th>Quy doi</th>
              </tr>
            </thead>
            <tbody>${assessmentRows}</tbody>
          </table>
        </section>

        <section class="section">
          <h2>Chung chi</h2>
          <p>Trang thai chung chi cua hoc sinh theo tung khoa hoc.</p>
          <table>
            <thead>
              <tr>
                <th>Khoa hoc</th>
                <th>Giao vien</th>
                <th>Trang thai</th>
                <th>So chung chi</th>
                <th>Ma xac thuc</th>
                <th>Ngay cap</th>
              </tr>
            </thead>
            <tbody>${certificateRows}</tbody>
          </table>
        </section>

        <p class="footer">Bao cao duoc xuat tu Parent Portal cua Bee Academy.</p>
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
