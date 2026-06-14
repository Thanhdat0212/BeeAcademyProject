import { motion } from 'motion/react';
import { ArrowRight, BookOpen, Users, Award, Star, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const MOCK_COURSES = [
  {
    id: 1,
    title: "Toán Học Nâng Cao Lớp 8",
    description: "Nắm vững đại số, hình học và kỹ năng giải quyết vấn đề với các bài học tương tác.",
    image: "https://images.unsplash.com/photo-1632516643720-e7f5d7d6eca9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    rating: 4.8,
    students: "1.2k",
    level: "Trung bình"
  },
  {
    id: 2,
    title: "Nhập Môn Vật Lý",
    description: "Hiểu các định luật cơ bản của tự nhiên thông qua lý thuyết và thực hành.",
    image: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    rating: 4.9,
    students: "850",
    level: "Cơ bản"
  },
  {
    id: 3,
    title: "Khoa Học Máy Tính 101",
    description: "Học những kiến thức cơ bản về lập trình, thuật toán và cấu trúc dữ liệu.",
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    rating: 4.7,
    students: "2.1k",
    level: "Mọi cấp độ"
  }
];

const FEATURES = [
  {
    icon: <BookOpen className="w-6 h-6 text-primary" />,
    title: "Học Tập Tương Tác",
    description: "Tham gia vào các nội dung học tập sinh động, bài tập thực hành và câu hỏi trắc nghiệm."
  },
  {
    icon: <Users className="w-6 h-6 text-primary" />,
    title: "Cộng Đồng Sôi Động",
    description: "Tham gia cùng hàng ngàn học viên và giáo viên để chia sẻ kiến thức và cùng phát triển."
  },
  {
    icon: <Award className="w-6 h-6 text-primary" />,
    title: "Nhận Chứng Chỉ",
    description: "Được công nhận thành tích học tập với các chứng chỉ uy tín sau khi hoàn thành khóa học."
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-sans overflow-hidden">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/50">
        <div className="max-w-7xl mx-auto px-4 md:px-10 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary text-on-primary rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-primary/20">
              B
            </div>
            <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              Bee Academy
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-medium text-on-surface-variant">
            <a href="#courses" className="hover:text-primary transition-colors">Khóa học</a>
            <a href="#features" className="hover:text-primary transition-colors">Tính năng</a>
            <a href="#testimonials" className="hover:text-primary transition-colors">Đánh giá</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hidden md:block font-medium hover:text-primary transition-colors">
              Đăng nhập
            </Link>
            <Link to="/register" className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all">
              Bắt Đầu Ngay
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 px-4 overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl -z-10 animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl -z-10 animate-pulse delay-700" />
          
          <div className="max-w-7xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container border border-outline-variant mb-8 text-sm font-medium text-primary">
                <Star className="w-4 h-4 fill-primary" />
                <span>Nền tảng học trực tuyến hàng đầu 2026</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
                Khám Phá Tiềm Năng Cùng <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                  Bee Academy
                </span>
              </h1>
              <p className="text-xl text-on-surface-variant max-w-2xl mx-auto mb-12 leading-relaxed">
                Trải nghiệm phương pháp học tập mới mẻ. Các khóa học tương tác, giảng viên chuyên gia và cộng đồng hỗ trợ tận tâm vì sự thành công của bạn.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/register">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 bg-primary text-on-primary px-8 py-4 rounded-full font-bold text-lg shadow-xl shadow-primary/30 w-full sm:w-auto justify-center"
                  >
                    Học Thử Ngay <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </Link>
                <a href="#courses" className="w-full sm:w-auto">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 rounded-full font-bold text-lg border-2 border-outline hover:border-primary hover:text-primary transition-colors w-full sm:w-auto"
                  >
                    Xem Khóa Học
                  </motion.button>
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-surface-container-lowest border-y border-outline-variant/30">
          <div className="max-w-7xl mx-auto px-4 md:px-10">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Tại Sao Chọn Bee Academy?</h2>
              <p className="text-on-surface-variant max-w-2xl mx-auto">Chúng tôi cung cấp các công cụ và môi trường tốt nhất để bạn làm chủ mọi kiến thức hiệu quả.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {FEATURES.map((feature, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.2, duration: 0.5 }}
                  className="bg-surface p-8 rounded-3xl shadow-sm border border-outline-variant/50 hover:shadow-xl hover:border-primary/50 transition-all group"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-on-surface-variant leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Courses Section */}
        <section id="courses" className="py-24 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Khóa Học Nổi Bật</h2>
                <p className="text-on-surface-variant">Khám phá các chương trình được yêu thích nhất của chúng tôi.</p>
              </div>
              <button className="hidden md:flex items-center gap-2 font-semibold text-primary hover:text-primary/80 transition-colors">
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {MOCK_COURSES.map((course, idx) => (
                <motion.div 
                  key={course.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  whileHover={{ y: -10 }}
                  className="bg-surface rounded-3xl overflow-hidden shadow-md border border-outline-variant/40 group"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={course.image} 
                      alt={course.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-4 left-4 bg-surface/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full">
                      {course.level}
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                        <Star className="w-4 h-4 fill-amber-500" /> {course.rating}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-on-surface-variant">
                        <Users className="w-4 h-4" /> {course.students}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-2 line-clamp-1">{course.title}</h3>
                    <p className="text-on-surface-variant text-sm mb-6 line-clamp-2">
                      {course.description}
                    </p>
                    <Link to="/quiz">
                      <button className="w-full py-3 rounded-xl font-bold text-primary bg-primary/10 hover:bg-primary hover:text-on-primary transition-colors">
                        Đăng Ký Ngay
                      </button>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-24 px-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto bg-gradient-to-br from-primary to-secondary rounded-[3rem] p-12 md:p-20 text-center text-on-primary shadow-2xl shadow-primary/20 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Sẵn Sàng Bứt Phá Tương Lai?</h2>
              <p className="text-lg md:text-xl text-on-primary/90 mb-10 max-w-2xl mx-auto">
                Tham gia cùng hàng ngàn học viên đang phát triển kiến thức và sự nghiệp cùng Bee Academy.
              </p>
              <Link to="/register">
                <button className="bg-surface text-primary px-10 py-4 rounded-full font-bold text-lg shadow-xl hover:scale-105 transition-transform">
                  Bắt Đầu Miễn Phí
                </button>
              </Link>
              
              <div className="mt-8 flex items-center justify-center gap-6 text-sm font-medium text-on-primary/80">
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Không cần thẻ tín dụng</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Hủy bất cứ lúc nào</div>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-highest py-12 border-t border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 md:px-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-on-primary rounded-lg flex items-center justify-center font-bold">
              B
            </div>
            <span className="text-xl font-bold text-on-surface">Bee Academy</span>
          </div>
          <div className="text-on-surface-variant text-sm">
            © 2026 Bee Academy. Đã đăng ký bản quyền.
          </div>
          <div className="flex gap-4 text-on-surface-variant">
            <a href="#" className="hover:text-primary transition-colors">Chính sách bảo mật</a>
            <a href="#" className="hover:text-primary transition-colors">Điều khoản dịch vụ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

