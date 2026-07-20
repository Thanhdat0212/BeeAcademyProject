import { expect, test, type Page } from '@playwright/test';
import type {
  ChildProgressReportResponse,
  LinkedStudentResponse,
  ParentRequiredExamResult,
} from '../src/types/api';

const GENERATED_AT = '2026-07-17T03:30:00Z';
const TRANSPARENT_AVATAR =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

const linkedChildren: LinkedStudentResponse[] = [
  {
    id: 'student-1',
    name: 'Nguyễn An',
    avatarUrl: TRANSPARENT_AVATAR,
    code: 'BEE024',
    grade: 'Lớp 6',
    linkStatus: 'active',
    unlinkRequestedById: null,
    unlinkRequestedByRole: null,
    unlinkRequestedAt: null,
  },
];

function configuredExams(courseVersionId: string): ParentRequiredExamResult[] {
  return [
    {
      slotIndex: 0,
      label: 'Giữa kỳ 1',
      examName: 'Đánh giá giữa học kỳ I',
      examType: 'chapter_test',
      status: 'passed',
      examConfigId: 'exam-1',
      courseVersionId,
      scorePercent: 84,
      normalizedScore: 8.4,
      passed: true,
      submittedAt: '2026-07-15T02:00:00Z',
    },
    {
      slotIndex: 1,
      label: 'Cuối kỳ 1',
      examName: 'Đánh giá cuối học kỳ I',
      examType: 'chapter_test',
      status: 'pending_grading',
      examConfigId: 'exam-2',
      courseVersionId,
      scorePercent: 75,
      normalizedScore: 7.5,
      passed: null,
      submittedAt: '2026-07-16T02:00:00Z',
    },
    {
      slotIndex: 2,
      label: 'Giữa kỳ 2',
      examName: 'Đánh giá giữa học kỳ II',
      examType: 'chapter_test',
      status: 'not_submitted',
      examConfigId: 'exam-3',
      courseVersionId,
      scorePercent: null,
      normalizedScore: null,
      passed: null,
      submittedAt: null,
    },
    {
      slotIndex: 3,
      label: 'Cuối kỳ 2',
      examName: 'Đánh giá cuối năm',
      examType: 'final_exam',
      status: 'in_progress',
      examConfigId: 'exam-4',
      courseVersionId,
      scorePercent: null,
      normalizedScore: null,
      passed: null,
      submittedAt: null,
    },
  ];
}

const baseReport: ChildProgressReportResponse = {
  studentId: 'student-1',
  studentName: 'Nguyễn An',
  gradeLabel: 'Lớp 6',
  generatedAt: GENERATED_AT,
  detailAccessAllowed: true,
  sensitiveDataMasked: false,
  detailAccessReason: 'CONSENT_NOT_REQUIRED',
  weeklySummary: {
    periodStart: '2026-07-11',
    periodEnd: '2026-07-17',
    progressTrend: 'increasing',
    currentWeekCompletedItems: 6,
    previousWeekCompletedItems: 3,
    averageScore: 8.1,
    completedAssessments: 2,
    incompleteCourses: 1,
    incompleteLearningItems: 4,
    inactiveDays: 2,
    actionRule: 'on_track',
    actionSuggestion: 'Duy trì nhịp học hiện tại và hoàn thành bài còn lại trước cuối tuần.',
  },
  courses: [
    {
      courseId: 'course-math',
      courseVersionId: 'version-math-1',
      courseTitle: 'Toán 6 nền tảng',
      teacherName: 'Cô Minh',
      status: 'active',
      progressPct: 72,
      enrolledAt: '2026-06-01T02:00:00Z',
      progressUpdatedAt: '2026-07-17T03:28:00Z',
      grades: [6],
      lessonCompletedCount: 8,
      lessonTotalCount: 12,
      quizCompletedCount: 3,
      quizTotalCount: 4,
      averageQuizScore: 8.2,
      latestQuizScore: 8.5,
      latestExamScore: 8.4,
      latestAssignmentScore: 9,
      completedLessons: [
        {
          lessonId: 'lesson-1',
          chapterId: 'chapter-1',
          chapterTitle: 'Số tự nhiên',
          chapterPosition: 1,
          lessonTitle: 'Phép cộng và phép trừ',
          lessonPosition: 2,
          durationSec: 900,
          completedAt: '2026-07-17T03:28:00Z',
        },
      ],
      requiredExams: configuredExams('version-math-1'),
    },
    {
      courseId: 'course-science',
      courseVersionId: 'version-science-1',
      courseTitle: 'Khoa học tự nhiên 6',
      teacherName: 'Thầy Nam',
      status: 'completed',
      progressPct: 100,
      enrolledAt: '2026-03-01T02:00:00Z',
      progressUpdatedAt: '2026-07-10T03:00:00Z',
      grades: [6],
      lessonCompletedCount: 10,
      lessonTotalCount: 10,
      quizCompletedCount: 4,
      quizTotalCount: 4,
      averageQuizScore: 9,
      latestQuizScore: 9.2,
      latestExamScore: 8.8,
      latestAssignmentScore: 8.5,
      completedLessons: [],
      requiredExams: configuredExams('version-science-1'),
    },
  ],
  assessments: [
    {
      id: 'quiz:math-1',
      courseId: 'course-math',
      courseTitle: 'Toán 6 nền tảng',
      courseStatus: 'active',
      assessmentName: 'Quiz - Số tự nhiên',
      assessmentType: 'quiz',
      chapterTitle: 'Số tự nhiên',
      rawScore: 8.5,
      maxScore: 10,
      normalizedScore: 8.5,
      feedback: 'Nắm chắc kiến thức cơ bản.',
      submittedAt: '2026-07-15T02:00:00Z',
    },
    {
      id: 'exam:science-1',
      courseId: 'course-science',
      courseTitle: 'Khoa học tự nhiên 6',
      courseStatus: 'completed',
      assessmentName: 'Đánh giá cuối năm',
      assessmentType: 'exam',
      chapterTitle: null,
      rawScore: 88,
      maxScore: 100,
      normalizedScore: 8.8,
      feedback: 'Hoàn thành tốt khóa học.',
      submittedAt: '2026-07-16T02:00:00Z',
    },
  ],
  certificates: [
    {
      certificateId: 'certificate-1',
      courseId: 'course-science',
      courseTitle: 'Khoa học tự nhiên 6',
      teacherName: 'Thầy Nam',
      status: 'ISSUED',
      certificateNo: 'BEE-2026-00024',
      verificationCode: 'VERIFY-UC24',
      versionNo: 1,
      issuedAt: '2026-07-16T03:00:00Z',
      revokedAt: null,
      reviewNote: null,
    },
  ],
};

interface RequestMetrics {
  reportRequests: number;
  exportRequests: number;
}

async function mockParentApi(
  page: Page,
  report: ChildProgressReportResponse,
  children: LinkedStudentResponse[] = linkedChildren,
): Promise<RequestMetrics> {
  const metrics: RequestMetrics = { reportRequests: 0, exportRequests: 0 };

  await page.addInitScript(() => {
    localStorage.setItem('bee-academy-auth', JSON.stringify({
      state: {
        isLoggedIn: true,
        user: {
          id: 'parent-1',
          name: 'Phụ huynh Nguyễn',
          email: 'parent@example.com',
          role: 'parent',
        },
        accessToken: 'e2e-access-token',
        refreshToken: null,
        linkedStudents: [],
      },
      version: 0,
    }));
    localStorage.removeItem('parent_active_student_id');
  });

  await page.route(/\/api\/system\/status(?:\?.*)?$/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiResponse({ maintenanceMode: false, maintenanceUntil: null }),
    });
  });

  await page.route(/\/api\/parent\/children\/[^/]+\/progress-report\/export(?:\?.*)?$/, async route => {
    metrics.exportRequests += 1;
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="parent-progress-student-1.xlsx"',
        'Cache-Control': 'no-store',
      },
      body: 'PK-e2e-xlsx-workbook',
    });
  });

  await page.route(/\/api\/parent\/children\/[^/]+\/progress-report(?:\?.*)?$/, async route => {
    metrics.reportRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiResponse(report),
    });
  });

  await page.route(/\/api\/parent\/children(?:\?.*)?$/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: apiResponse(children),
    });
  });

  return metrics;
}

function apiResponse(data: unknown): string {
  return JSON.stringify({
    success: true,
    message: 'OK',
    data,
    timestamp: GENERATED_AT,
  });
}

test('UC24: parent views, filters, refreshes and downloads the weekly XLSX report', async ({ page }) => {
  const metrics = await mockParentApi(page, baseReport);

  await page.goto('/parent/progress');

  await expect(page.getByTestId('parent-progress-page')).toBeVisible();
  await expect(page.getByText('UC24 · Theo dõi tiến độ học tập')).toBeVisible();
  await expect(page.getByTestId('weekly-report')).toContainText('Báo cáo 7 ngày');
  await expect(page.getByTestId('weekly-report')).toContainText('Duy trì nhịp học hiện tại');
  await expect(page.getByTestId('course-progress-course-math')).toContainText('72%');
  await expect(page.getByTestId('required-exam-course-math-0')).toContainText('Đánh giá giữa học kỳ I');
  await expect(page.getByTestId('required-exam-course-math-0')).toContainText('Giữa kỳ');
  await expect(page.getByTestId('required-exam-course-math-3')).toContainText('Đánh giá cuối năm');
  await expect(page.getByTestId('required-exam-course-math-3')).toContainText('Cuối kỳ');

  await page.getByTestId('course-filter').selectOption('course-science');
  await expect(page.getByTestId('course-progress-course-science')).toBeVisible();
  await expect(page.getByTestId('course-progress-course-math')).toHaveCount(0);

  await page.getByTestId('status-filter').selectOption('active');
  await expect(page.getByText('Không có dữ liệu phù hợp')).toBeVisible();
  await page.getByRole('button', { name: 'Xóa lọc' }).click();

  await page.getByTestId('from-date-filter').fill('2026-07-16');
  await page.getByTestId('to-date-filter').fill('2026-07-16');
  await expect(page.getByTestId('assessment-exam:science-1')).toBeVisible();
  await expect(page.getByTestId('assessment-quiz:math-1')).toHaveCount(0);

  await expect.poll(() => metrics.reportRequests).toBeGreaterThanOrEqual(1);
  const requestCountBeforeRefresh = metrics.reportRequests;
  await page.getByTestId('refresh-progress').click();
  await expect.poll(() => metrics.reportRequests).toBeGreaterThan(requestCountBeforeRefresh);
  await expect(page.getByText('Đã cập nhật báo cáo tiến độ mới nhất.')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-progress-xlsx').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('bao-cao-tien-do-nguyen-an.xlsx');
  expect(metrics.exportRequests).toBe(1);
});

test('UC24: privacy consent masks sensitive feedback on the real report UI', async ({ page }) => {
  const privacyReport: ChildProgressReportResponse = {
    ...baseReport,
    detailAccessAllowed: false,
    sensitiveDataMasked: true,
    detailAccessReason: 'STUDENT_16_PLUS_PRIVACY_ENABLED_REQUIRE_CONSENT',
    assessments: baseReport.assessments.map(assessment => ({
      ...assessment,
      feedback: null,
    })),
  };
  await mockParentApi(page, privacyReport);

  await page.goto('/parent/progress');

  await expect(page.getByTestId('privacy-warning')).toContainText('Đang ẩn dữ liệu nhạy cảm');
  await expect(page.getByTestId('privacy-warning')).toContainText('Học sinh từ 16 tuổi');
  await expect(page.getByTestId('assessment-quiz:math-1')).toContainText(
    'Đang ẩn theo quyền riêng tư/consent',
  );
});

test('UC24: parent without an ACTIVE child link sees the empty state only', async ({ page }) => {
  const metrics = await mockParentApi(page, baseReport, []);

  await page.goto('/parent/progress');

  await expect(page.getByTestId('parent-progress-empty')).toBeVisible();
  await expect(page.getByText('Chưa liên kết tài khoản con')).toBeVisible();
  expect(metrics.reportRequests).toBe(0);
});
