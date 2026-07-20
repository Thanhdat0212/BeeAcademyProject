import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import MaintenanceGate from './components/MaintenanceGate';

const LandingPage = lazy(() => import('./pages/common/LandingPage'));
const Login = lazy(() => import('./pages/common/Login'));
const Register = lazy(() => import('./pages/common/Register'));
const ForgotPassword = lazy(() => import('./pages/common/ForgotPassword'));
const OAuthCallbackPage = lazy(() => import('./pages/common/OAuthCallbackPage'));
const CertificateVerifyPage = lazy(() => import('./pages/common/CertificateVerifyPage'));

const CoursesPage = lazy(() => import('./pages/student/CoursesPage'));
const CourseDetailPage = lazy(() => import('./pages/student/CourseDetailPage'));
const CheckoutPage = lazy(() => import('./pages/student/CheckoutPage'));
const PaymentResultPage = lazy(() => import('./pages/student/PaymentResultPage'));
const OrdersPage = lazy(() => import('./pages/student/OrdersPage'));
const ComingSoonPage = lazy(() => import('./pages/student/ComingSoonPage'));
const MessagesPage = lazy(() => import('./pages/student/MessagesPage'));
const ProfilePage = lazy(() => import('./pages/student/ProfilePage'));
const FavoritesPage = lazy(() => import('./pages/student/FavoritesPage'));
const AccountPage = lazy(() => import('./pages/student/AccountPage'));
const AvatarPage = lazy(() => import('./pages/student/AvatarPage'));
const ComplaintsPage = lazy(() => import('./pages/student/ComplaintsPage'));
const ProgressPage = lazy(() => import('./pages/student/ProgressPage'));
const RewardsPage = lazy(() => import('./pages/student/RewardsPage'));
const StudentQuizPage = lazy(() => import('./pages/student/StudentQuizPage'));
const StudentExamPage = lazy(() => import('./pages/student/StudentExamPage'));
const ExamAiResultPage = lazy(() => import('./pages/student/ExamAiResultPage'));
const NotificationsPage = lazy(() => import('./pages/student/NotificationsPage'));
const CertificatesPage = lazy(() => import('./pages/student/CertificatesPage'));
const AiTutorPage = lazy(() => import('./pages/student/AiTutorPage'));

const ParentDashboard = lazy(() => import('./pages/parents/ParentDashboard'));
const ParentCourses = lazy(() => import('./pages/parents/ParentCourses'));
const ParentProgress = lazy(() => import('./pages/parents/ParentProgress'));
const ParentMessages = lazy(() => import('./pages/parents/ParentMessages'));
const ParentStudentLink = lazy(() => import('./pages/parents/ParentStudentLink'));
const ParentPayments = lazy(() => import('./pages/parents/ParentPayments'));

const QuizPage = lazy(() => import('./pages/teacher/QuizPage'));
const DashboardTeacher = lazy(() => import('./pages/teacher/DashboardTeacher'));
const TeacherCoursesPage = lazy(() => import('./pages/teacher/CoursesPage'));
const TeacherContentPage = lazy(() => import('./pages/teacher/ContentPage'));
const TeacherQuizChapterPage = lazy(() => import('./pages/teacher/QuizChapterPage'));
const TeacherExamPage = lazy(() => import('./pages/teacher/ExamPage'));
const TeacherGradesPage = lazy(() => import('./pages/teacher/GradesPage'));
const TeacherQAPage = lazy(() => import('./pages/teacher/QAPage'));
const TeacherRevenuePage = lazy(() => import('./pages/teacher/RevenuePage'));
const TeacherBankPage = lazy(() => import('./pages/teacher/BankPage'));
const TeacherComplaintsPage = lazy(() => import('./pages/teacher/ComplaintsPage'));
const TeacherReviewsPage = lazy(() => import('./pages/teacher/ReviewsPage'));
const QuestionBankPage = lazy(() => import('./pages/teacher/QuestionBankPage'));
const TeacherProfilePage = lazy(() => import('./pages/teacher/ProfilePage'));
const TeacherAccountPage = lazy(() => import('./pages/teacher/AccountPage'));

const DashboardAdmin = lazy(() => import('./pages/admin/DashboardAdmin'));
const ApprovalsPage = lazy(() => import('./pages/admin/ApprovalsPage'));
const CourseReviewPage = lazy(() => import('./pages/admin/CourseReviewPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface" role="status" aria-label="Đang tải">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <MaintenanceGate>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ── Public ── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/certificates/verify/:verificationCode" element={<CertificateVerifyPage />} />


        {/* ── Student (cần đăng nhập) ── */}
        <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
        {/* Giữ public (không ProtectedRoute): khách vãng lai duyệt danh sách + chi tiết
            + học thử khóa miễn phí khi chưa đăng nhập. Không gắn role="student" như team3
            để không chặn luồng học thử/SEO trang khóa học. */}
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/student/courses" element={<ProtectedRoute role="student"><CoursesPage /></ProtectedRoute>} />
        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/student/courses/:id" element={<ProtectedRoute role="student"><CourseDetailPage /></ProtectedRoute>} />
        <Route path="/courses/:courseId/chapters/:chapterId/quiz" element={<ProtectedRoute><StudentQuizPage /></ProtectedRoute>} />
        <Route path="/student/courses/:courseId/chapters/:chapterId/quiz" element={<ProtectedRoute role="student"><StudentQuizPage /></ProtectedRoute>} />
        <Route path="/courses/:courseId/exams/:slotIndex" element={<ProtectedRoute><StudentExamPage /></ProtectedRoute>} />
        <Route path="/courses/:courseId/exams/:slotIndex/ai-result/:attemptId" element={<ProtectedRoute><ExamAiResultPage /></ProtectedRoute>} />
        <Route path="/student/courses/:courseId/exams/:slotIndex" element={<ProtectedRoute role="student"><StudentExamPage /></ProtectedRoute>} />
        <Route path="/checkout"      element={<ProtectedRoute role="student"><CheckoutPage /></ProtectedRoute>} />
        <Route path="/payment-result" element={<ProtectedRoute role="student"><PaymentResultPage /></ProtectedRoute>} />
        <Route path="/orders"        element={<ProtectedRoute role="student"><OrdersPage /></ProtectedRoute>} />
        <Route path="/student/orders" element={<ProtectedRoute role="student"><OrdersPage /></ProtectedRoute>} />
        <Route path="/favorites"     element={<ProtectedRoute role="student"><FavoritesPage /></ProtectedRoute>} />
        <Route path="/student/favorites" element={<ProtectedRoute role="student"><FavoritesPage /></ProtectedRoute>} />
        <Route path="/progress"      element={<ProtectedRoute role="student"><ProgressPage /></ProtectedRoute>} />
        <Route path="/student/progress" element={<ProtectedRoute role="student"><ProgressPage /></ProtectedRoute>} />
        <Route path="/rewards"       element={<ProtectedRoute role="student"><RewardsPage /></ProtectedRoute>} />
        <Route path="/student/rewards" element={<ProtectedRoute role="student"><RewardsPage /></ProtectedRoute>} />
        <Route path="/certificates"  element={<ProtectedRoute role="student"><CertificatesPage /></ProtectedRoute>} />
        <Route path="/student/certificates" element={<ProtectedRoute role="student"><CertificatesPage /></ProtectedRoute>} />
        <Route path="/ai-tutor"      element={<ProtectedRoute role="student"><AiTutorPage /></ProtectedRoute>} />
        <Route path="/student/ai-tutor" element={<ProtectedRoute role="student"><AiTutorPage /></ProtectedRoute>} />
        <Route path="/messages"      element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/student/qa"    element={<ProtectedRoute role="student"><MessagesPage /></ProtectedRoute>} />
        <Route path="/student/messages" element={<ProtectedRoute role="student"><MessagesPage /></ProtectedRoute>} />
        <Route path="/profile"       element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/student/profile" element={<ProtectedRoute role="student"><ProfilePage /></ProtectedRoute>} />
        <Route path="/account/type"  element={<ProtectedRoute><ComingSoonPage title="Loại tài khoản" subtitle="Quản lý gói đăng ký của bạn" /></ProtectedRoute>} />
        <Route path="/student/account/type" element={<ProtectedRoute role="student"><ComingSoonPage title="Loại tài khoản" subtitle="Quản lý gói đăng ký của bạn" /></ProtectedRoute>} />
        <Route path="/account/photo" element={<ProtectedRoute><AvatarPage /></ProtectedRoute>} />
        <Route path="/student/account/photo" element={<ProtectedRoute role="student"><AvatarPage /></ProtectedRoute>} />
        <Route path="/account"       element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
        <Route path="/student/account" element={<ProtectedRoute role="student"><AccountPage /></ProtectedRoute>} />
        <Route path="/complaints"    element={<ProtectedRoute><ComplaintsPage /></ProtectedRoute>} />
        <Route path="/student/complaints" element={<ProtectedRoute role="student"><ComplaintsPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute role="student"><NotificationsPage /></ProtectedRoute>} />
        <Route path="/student/notifications" element={<ProtectedRoute role="student"><NotificationsPage /></ProtectedRoute>} />

        {/* ── Parent (chỉ role=parent) ── */}
        <Route path="/parent"          element={<ProtectedRoute role="parent"><ParentDashboard /></ProtectedRoute>} />
        <Route path="/parent/courses"  element={<ProtectedRoute role="parent"><ParentCourses /></ProtectedRoute>} />
        <Route path="/parent/progress" element={<ProtectedRoute role="parent"><ParentProgress /></ProtectedRoute>} />
        <Route path="/parent/payments" element={<ProtectedRoute role="parent"><ParentPayments /></ProtectedRoute>} />
        <Route path="/parent/messages" element={<ProtectedRoute role="parent"><ParentMessages /></ProtectedRoute>} />
        <Route path="/parent/link"     element={<ProtectedRoute role="parent"><ParentStudentLink /></ProtectedRoute>} />

        {/* ── Teacher (chỉ role=teacher) ── */}
        <Route path="/teacher"            element={<ProtectedRoute role="teacher"><DashboardTeacher /></ProtectedRoute>} />
        <Route path="/teacher/courses"    element={<ProtectedRoute role="teacher"><TeacherCoursesPage /></ProtectedRoute>} />
        <Route path="/teacher/reviews"    element={<ProtectedRoute role="teacher"><TeacherReviewsPage /></ProtectedRoute>} />
        <Route path="/teacher/courses/:courseId/reviews" element={<ProtectedRoute role="teacher"><TeacherReviewsPage /></ProtectedRoute>} />
        <Route path="/teacher/content"    element={<ProtectedRoute role="teacher"><TeacherContentPage /></ProtectedRoute>} />
        <Route path="/teacher/quiz"       element={<ProtectedRoute role="teacher"><TeacherQuizChapterPage /></ProtectedRoute>} />
        <Route path="/teacher/exam"       element={<ProtectedRoute role="teacher"><TeacherExamPage /></ProtectedRoute>} />
        <Route path="/teacher/grades"     element={<ProtectedRoute role="teacher"><TeacherGradesPage /></ProtectedRoute>} />
        <Route path="/teacher/qa"         element={<ProtectedRoute role="teacher"><TeacherQAPage /></ProtectedRoute>} />
        <Route path="/teacher/complaints" element={<ProtectedRoute role="teacher"><TeacherComplaintsPage /></ProtectedRoute>} />
        <Route path="/teacher/revenue"    element={<ProtectedRoute role="teacher"><TeacherRevenuePage /></ProtectedRoute>} />
        <Route path="/teacher/bank"       element={<ProtectedRoute role="teacher"><TeacherBankPage /></ProtectedRoute>} />
        <Route path="/teacher/questions"  element={<ProtectedRoute role="teacher"><QuestionBankPage /></ProtectedRoute>} />
        <Route path="/teacher/profile"    element={<ProtectedRoute role="teacher"><TeacherProfilePage /></ProtectedRoute>} />
        <Route path="/teacher/account"    element={<ProtectedRoute role="teacher"><TeacherAccountPage /></ProtectedRoute>} />

        {/* ── Admin (chỉ role=admin) ── */}
        <Route path="/admin"                     element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
        <Route path="/admin/users"               element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
        <Route path="/admin/courses"             element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
        <Route path="/admin/payouts"             element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
        <Route path="/admin/complaints"          element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
        <Route path="/admin/qa"                  element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
        <Route path="/admin/reviews"             element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
        <Route path="/admin/notifications"       element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
        <Route path="/admin/approvals"           element={<ProtectedRoute role="admin"><ApprovalsPage /></ProtectedRoute>} />
        <Route path="/admin/approvals/:courseId" element={<ProtectedRoute role="admin"><CourseReviewPage /></ProtectedRoute>} />
        <Route path="/admin/teachers"   element={<ProtectedRoute role="admin"><ComingSoonPage title="Quản lý giáo viên"    subtitle="Danh sách và thông tin giáo viên" /></ProtectedRoute>} />
        <Route path="/admin/accounting" element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
        <Route path="/admin/salary"     element={<ProtectedRoute role="admin"><ComingSoonPage title="Lương"                subtitle="Quản lý lương giáo viên và nhân sự" /></ProtectedRoute>} />
        <Route path="/admin/reports"    element={<ProtectedRoute role="admin"><AdminReportsPage /></ProtectedRoute>} />
        <Route path="/admin/settings"   element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
      </Routes>
      </Suspense>
      </MaintenanceGate>
    </BrowserRouter>
  );
}
