import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/common/LandingPage';
import QuizPage from './pages/teacher/QuizPage';
import Login from './pages/common/Login';
import Register from './pages/common/Register';
import ForgotPassword from './pages/common/ForgotPassword';
import CoursesPage from './pages/student/CoursesPage';
import CourseDetailPage from './pages/student/CourseDetailPage';
import CheckoutPage from './pages/student/CheckoutPage';
import PaymentResultPage from './pages/student/PaymentResultPage';
import OrdersPage from './pages/student/OrdersPage';
import ComingSoonPage from './pages/student/ComingSoonPage';
import MessagesPage from './pages/student/MessagesPage';
import ProfilePage from './pages/student/ProfilePage';
import FavoritesPage from './pages/student/FavoritesPage';
import AccountPage from './pages/student/AccountPage';
import AvatarPage from './pages/student/AvatarPage';
import ComplaintsPage from './pages/student/ComplaintsPage';
import StudentQuizPage from './pages/student/StudentQuizPage';
import StudentExamPage from './pages/student/StudentExamPage';
import NotificationsPage from './pages/student/NotificationsPage';
import DashboardAdmin from './pages/admin/DashboardAdmin';
import DashboardTeacher from './pages/teacher/DashboardTeacher';
import TeacherCoursesPage from './pages/teacher/CoursesPage';
import TeacherContentPage from './pages/teacher/ContentPage';
import TeacherQuizChapterPage from './pages/teacher/QuizChapterPage';
import TeacherExamPage from './pages/teacher/ExamPage';
import TeacherGradesPage from './pages/teacher/GradesPage';
import TeacherQAPage from './pages/teacher/QAPage';
import TeacherRevenuePage from './pages/teacher/RevenuePage';
import TeacherBankPage from './pages/teacher/BankPage';
import TeacherComplaintsPage from './pages/teacher/ComplaintsPage';
import QuestionBankPage from './pages/teacher/QuestionBankPage';
import TeacherProfilePage from './pages/teacher/ProfilePage';
import TeacherAccountPage from './pages/teacher/AccountPage';
import ApprovalsPage from './pages/admin/ApprovalsPage';
import CourseReviewPage from './pages/admin/CourseReviewPage';
import OAuthCallbackPage from './pages/common/OAuthCallbackPage';
import ParentDashboard from './pages/parents/ParentDashboard';
import ParentCourses from './pages/parents/ParentCourses';
import ParentProgress from './pages/parents/ParentProgress';
import ParentMessages from './pages/parents/ParentMessages';
import ParentStudentLink from './pages/parents/ParentStudentLink';
import ParentPayments from './pages/parents/ParentPayments';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        {/* ── Public ── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />


        {/* ── Student (cần đăng nhập) ── */}
        <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
        <Route path="/courses" element={<ProtectedRoute role="student"><CoursesPage /></ProtectedRoute>} />
        <Route path="/courses/:id" element={<ProtectedRoute role="student"><CourseDetailPage /></ProtectedRoute>} />
        <Route path="/courses/:courseId/chapters/:chapterId/quiz" element={<ProtectedRoute><StudentQuizPage /></ProtectedRoute>} />
        <Route path="/courses/:courseId/exams/:slotIndex" element={<ProtectedRoute><StudentExamPage /></ProtectedRoute>} />
        <Route path="/checkout"      element={<ProtectedRoute role="student"><CheckoutPage /></ProtectedRoute>} />
        <Route path="/payment-result" element={<ProtectedRoute role="student"><PaymentResultPage /></ProtectedRoute>} />
        <Route path="/orders"        element={<ProtectedRoute role="student"><OrdersPage /></ProtectedRoute>} />
        <Route path="/favorites"     element={<ProtectedRoute role="student"><FavoritesPage /></ProtectedRoute>} />
        <Route path="/messages"      element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/profile"       element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/account/type"  element={<ProtectedRoute><ComingSoonPage title="Loại tài khoản" subtitle="Quản lý gói đăng ký của bạn" /></ProtectedRoute>} />
        <Route path="/account/photo" element={<ProtectedRoute><AvatarPage /></ProtectedRoute>} />
        <Route path="/account"       element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
        <Route path="/complaints"    element={<ProtectedRoute><ComplaintsPage /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute role="student"><NotificationsPage /></ProtectedRoute>} />

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
        <Route path="/admin/complaints"          element={<ProtectedRoute role="admin"><DashboardAdmin /></ProtectedRoute>} />
        <Route path="/admin/approvals"           element={<ProtectedRoute role="admin"><ApprovalsPage /></ProtectedRoute>} />
        <Route path="/admin/approvals/:courseId" element={<ProtectedRoute role="admin"><CourseReviewPage /></ProtectedRoute>} />
        <Route path="/admin/teachers"   element={<ProtectedRoute role="admin"><ComingSoonPage title="Quản lý giáo viên"    subtitle="Danh sách và thông tin giáo viên" /></ProtectedRoute>} />
        <Route path="/admin/accounting" element={<ProtectedRoute role="admin"><ComingSoonPage title="Kế toán"              subtitle="Quản lý thu chi và báo cáo tài chính" /></ProtectedRoute>} />
        <Route path="/admin/salary"     element={<ProtectedRoute role="admin"><ComingSoonPage title="Lương"                subtitle="Quản lý lương giáo viên và nhân sự" /></ProtectedRoute>} />
        <Route path="/admin/reports"    element={<ProtectedRoute role="admin"><ComingSoonPage title="Báo cáo & Thống kê"   subtitle="Phân tích dữ liệu và báo cáo tổng hợp" /></ProtectedRoute>} />
        <Route path="/admin/settings"   element={<ProtectedRoute role="admin"><ComingSoonPage title="Cài đặt hệ thống"     subtitle="Cấu hình và tuỳ chỉnh hệ thống" /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
