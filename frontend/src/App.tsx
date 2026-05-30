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
import OAuthCallbackPage from './pages/common/OAuthCallbackPage';
import ParentDashboard from './pages/parents/ParentDashboard';
import ParentCourses from './pages/parents/ParentCourses';

import ParentProgress from './pages/parents/ParentProgress';
import ParentMessages from './pages/parents/ParentMessages';
import ParentStudentLink from './pages/parents/ParentStudentLink';

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


        {/* ── Student ── */}
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:id" element={<CourseDetailPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment-result" element={<PaymentResultPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/favorites"     element={<FavoritesPage />} />
        <Route path="/messages"      element={<MessagesPage />} />
        <Route path="/profile"       element={<ProfilePage />} />
        <Route path="/account/type"  element={<ComingSoonPage title="Loại tài khoản"        subtitle="Quản lý gói đăng ký của bạn" />} />
        <Route path="/account/photo" element={<AvatarPage />} />
        <Route path="/account"       element={<AccountPage />} />
        <Route path="/complaints"    element={<ComplaintsPage />} />

        {/* ── Parent ── */}
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/parent/courses" element={<ParentCourses />} />

        <Route path="/parent/progress" element={<ParentProgress />} />
        <Route path="/parent/messages" element={<ParentMessages />} />
        <Route path="/parent/link" element={<ParentStudentLink />} />

        {/* ── Teacher ── */}
        <Route path="/teacher"          element={<DashboardTeacher />} />
        <Route path="/teacher/courses"  element={<TeacherCoursesPage />} />
        <Route path="/teacher/content"  element={<TeacherContentPage />} />
        <Route path="/teacher/quiz"     element={<TeacherQuizChapterPage />} />
        <Route path="/teacher/exam"     element={<TeacherExamPage />} />
        <Route path="/teacher/grades"   element={<TeacherGradesPage />} />
        <Route path="/teacher/qa"       element={<TeacherQAPage />} />
        <Route path="/teacher/complaints" element={<TeacherComplaintsPage />} />
        <Route path="/teacher/revenue"  element={<TeacherRevenuePage />} />
        <Route path="/teacher/bank"     element={<TeacherBankPage />} />

        {/* ── Admin ── */}
        <Route path="/admin"          element={<DashboardAdmin />} />
        <Route path="/admin/teachers"   element={<ComingSoonPage title="Quản lý giáo viên" subtitle="Danh sách và thông tin giáo viên" />} />
        <Route path="/admin/accounting" element={<ComingSoonPage title="Kế toán"           subtitle="Quản lý thu chi và báo cáo tài chính" />} />
        <Route path="/admin/salary"     element={<ComingSoonPage title="Lương"             subtitle="Quản lý lương giáo viên và nhân sự" />} />
        <Route path="/admin/reports"    element={<ComingSoonPage title="Báo cáo & Thống kê" subtitle="Phân tích dữ liệu và báo cáo tổng hợp" />} />
        <Route path="/admin/settings"   element={<ComingSoonPage title="Cài đặt hệ thống"  subtitle="Cấu hình và tuỳ chỉnh hệ thống" />} />
      </Routes>
    </BrowserRouter>
  );
}
