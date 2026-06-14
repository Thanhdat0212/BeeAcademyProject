import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  MessageSquare, Search, Filter, Send, Image, Paperclip, 
  ChevronRight, Phone, Video, AlertCircle, Info, MoreVertical, ShieldAlert
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';

// ---------------------------------------------------------------------------
//  Mock Danh sách Giáo viên bộ môn của con
// ---------------------------------------------------------------------------
interface TeacherContact {
  id: string;
  name: string;
  subject: string;
  class: string;
  avatar: string;
  status: 'online' | 'offline' | string;
  lastMessage: string;
  lastMessageTime: string;
  unread: boolean;
  important: boolean;
}

const MOCK_TEACHERS: TeacherContact[] = [
  {
    id: 't1',
    name: 'Cô Nguyễn Thị Mai',
    subject: 'Toán học',
    class: 'Lớp 8A1',
    avatar: 'https://ui-avatars.com/api/?name=Nguyen+Mai&background=ad2c00&color=fff&bold=true&size=128',
    status: 'Đang trực tuyến',
    lastMessage: 'Gia đình tiếp tục động viên cháu ôn tập tốt phần phương trình bậc nhất tuần tới nhé.',
    lastMessageTime: '10:42 AM',
    unread: true,
    important: true
  },
  {
    id: 't2',
    name: 'Thầy Lê Cường',
    subject: 'Vật lý',
    class: 'Lớp 8A1',
    avatar: 'https://ui-avatars.com/api/?name=Le+Cuong&background=7c5800&color=fff&bold=true&size=128',
    status: 'Hoạt động 15 phút trước',
    lastMessage: 'Dạ tôi đã nhắc nhở cháu ôn tập thêm ở nhà. Cảm ơn thầy.',
    lastMessageTime: 'Hôm qua',
    unread: false,
    important: false
  },
  {
    id: 't3',
    name: 'Cô Trần Lan',
    subject: 'Ngữ văn',
    class: 'Lớp 8A1',
    avatar: 'https://ui-avatars.com/api/?name=Tran+Lan&background=008080&color=fff&bold=true&size=128',
    status: 'Hoạt động 2 giờ trước',
    lastMessage: 'Cô đã gửi nhận xét bài tự luận chương 1 của Minh Anh vào học bạ.',
    lastMessageTime: '24/05/2026',
    unread: false,
    important: false
  }
];

// ---------------------------------------------------------------------------
//  Mock Lịch sử Tin nhắn chi tiết
// ---------------------------------------------------------------------------
interface ChatMessage {
  id: string;
  sender: 'teacher' | 'parent';
  text: string;
  time: string;
  attachment?: {
    type: 'image' | 'file';
    name: string;
    url: string;
  };
}

const INITIAL_CHAT_MESSAGES: Record<string, ChatMessage[]> = {
  't1': [
    {
      id: 'm1',
      sender: 'teacher',
      text: 'Chào phụ huynh Minh Anh, hôm nay tôi gửi kết quả kiểm tra 15 phút môn Toán của cháu. Cháu làm bài xuất sắc đạt điểm 9.0.',
      time: '10:30 AM'
    },
    {
      id: 'm2',
      sender: 'teacher',
      text: 'Tôi đính kèm ảnh bài làm chi tiết dưới đây để anh chị tiện theo dõi lỗi sai nhỏ ở câu số 5.',
      time: '10:31 AM',
      attachment: {
        type: 'image',
        name: 'Bai_Kiem_Tra_Minh_Anh.jpg',
        url: 'https://images.unsplash.com/photo-1453733190148-c44698c26588?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80' // Mượn ảnh tài liệu
      }
    },
    {
      id: 'm3',
      sender: 'parent',
      text: 'Dạ vâng, cảm ơn cô giáo nhiều ạ. Gia đình rất mừng khi cháu tiến bộ và hiểu bài sâu sắc.',
      time: '10:38 AM'
    },
    {
      id: 'm4',
      sender: 'teacher',
      text: 'Gia đình tiếp tục động viên cháu ôn tập tốt phần phương trình bậc nhất tuần tới nhé.',
      time: '10:42 AM'
    }
  ],
  't2': [
    {
      id: 'm5',
      sender: 'teacher',
      text: 'Chào anh chị, điểm kiểm tra lý thuyết chương Từ trường của cháu Minh Anh hơi thấp, chỉ được 6.5. Cháu còn mơ hồ phần định luật Ôm.',
      time: 'Hôm qua, 14:00'
    },
    {
      id: 'm6',
      sender: 'parent',
      text: 'Dạ tôi đã nhắc nhở cháu ôn tập thêm ở nhà và tự làm lại bài tập. Cảm ơn thầy đã phản hồi sát sao.',
      time: 'Hôm qua, 14:15'
    }
  ],
  't3': [
    {
      id: 'm7',
      sender: 'teacher',
      text: 'Chào phụ huynh, cô đã gửi nhận xét bài tự luận chương 1 của Minh Anh vào hệ thống. Cháu viết bài rất có cảm xúc.',
      time: '24/05/2026'
    }
  ]
};

export default function ParentMessages() {
  const { linkedStudents, fetchLinkedStudents } = useAuthStore();

  // Tải danh sách con cái từ API thật khi component mount
  useEffect(() => {
    fetchLinkedStudents();
  }, [fetchLinkedStudents]);

  const [teachers, setTeachers] = useState<TeacherContact[]>(MOCK_TEACHERS);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('t1');
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>(INITIAL_CHAT_MESSAGES);
  
  // State soạn thảo tin nhắn
  const [inputText, setInputText] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'important'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống cuối khung chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, selectedTeacherId]);

  // Giáo viên đang chọn
  const activeTeacher = teachers.find(t => t.id === selectedTeacherId);

  // Lọc danh sách giáo viên
  const filteredTeachers = teachers.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.subject.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterType === 'unread') return matchSearch && t.unread;
    if (filterType === 'important') return matchSearch && t.important;
    return matchSearch;
  });

  // Gửi tin nhắn mới
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg: ChatMessage = {
      id: `m_new_${Date.now()}`,
      sender: 'parent',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => ({
      ...prev,
      [selectedTeacherId]: [...(prev[selectedTeacherId] || []), newMsg]
    }));

    // Cập nhật lastMessage của giáo viên đó
    setTeachers(prev => prev.map(t => {
      if (t.id === selectedTeacherId) {
        return {
          ...t,
          lastMessage: inputText.trim(),
          lastMessageTime: '10:42 AM', // mock current
          unread: false
        };
      }
      return t;
    }));

    setInputText('');
  };

  // Click vào giáo viên để chat
  const handleSelectTeacher = (id: string) => {
    setSelectedTeacherId(id);
    
    // Đánh dấu đã đọc
    setTeachers(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, unread: false };
      }
      return t;
    }));
  };

  if (linkedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-sans">
        <DashboardHeader />
        <PageBanner title="Tin nhắn giáo viên" subtitle="Trao đổi thông tin trực tiếp với giáo viên của con" />
        <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-12 text-center">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-10 max-w-xl mx-auto shadow-sm">
            <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-extrabold text-on-surface">Chưa liên kết tài khoản con</h3>
            <p className="text-xs text-on-surface-variant mt-2 mb-6">Liên kết tài khoản con để gửi tin nhắn giáo viên.</p>
          </div>
        </div>
      </div>
    );
  }

  const currentChat = chatMessages[selectedTeacherId] || [];

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />
      
      <PageBanner 
        title="Tin nhắn giáo viên" 
        subtitle="Hệ thống chat thời gian thực kết nối trực tiếp Phụ huynh và Giáo viên bộ môn của con" 
      />

      {/* Chat Container */}
      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 h-[650px]">
          
          {/* CỘT TRÁI (4/12): DANH SÁCH GIÁO VIÊN */}
          <div className="lg:col-span-4 border-r border-outline-variant/20 flex flex-col h-full bg-surface-container-lowest">
            
            {/* Thanh Tìm kiếm */}
            <div className="p-4 border-b border-outline-variant/20 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/60 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Tìm giáo viên hoặc môn học..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-xs transition-all placeholder:text-on-surface-variant/45 text-on-surface font-semibold"
                />
              </div>

              {/* Bộ lọc nhanh */}
              <div className="flex gap-1.5">
                {(['all', 'unread', 'important'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-colors border ${
                      filterType === type 
                        ? 'bg-primary text-on-primary border-primary shadow-sm' 
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container'
                    }`}
                  >
                    {type === 'all' && 'Tất cả'}
                    {type === 'unread' && 'Chưa đọc'}
                    {type === 'important' && 'Quan trọng'}
                  </button>
                ))}
              </div>
            </div>

            {/* List giáo viên */}
            <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
              {filteredTeachers.length === 0 ? (
                <div className="py-12 text-center text-xs text-on-surface-variant">
                  Không tìm thấy giáo viên nào.
                </div>
              ) : (
                filteredTeachers.map(teacher => {
                  const isActive = teacher.id === selectedTeacherId;
                  return (
                    <div
                      key={teacher.id}
                      onClick={() => handleSelectTeacher(teacher.id)}
                      className={`flex items-center gap-3 p-4 cursor-pointer select-none transition-colors relative ${
                        isActive ? 'bg-primary/5' : 'hover:bg-surface-container-low/40'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <img 
                          src={teacher.avatar} 
                          alt={teacher.name} 
                          className="w-10 h-10 rounded-full border border-outline-variant/20 object-cover"
                        />
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                      </div>

                      {/* Info & Last message */}
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start">
                          <p className={`text-xs truncate ${isActive ? 'font-extrabold text-primary' : 'font-extrabold text-on-surface'}`}>
                            {teacher.name}
                          </p>
                          <span className="text-[9px] text-on-surface-variant/75 font-semibold whitespace-nowrap ml-2">
                            {teacher.lastMessageTime}
                          </span>
                        </div>
                        <p className="text-[10px] text-primary font-bold mt-0.5">
                          {teacher.subject} — {teacher.class}
                        </p>
                        <p className="text-[10px] text-on-surface-variant truncate mt-1 leading-tight">
                          {teacher.lastMessage}
                        </p>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {teacher.unread && (
                          <span className="w-2 h-2 bg-red-500 rounded-full" />
                        )}
                        {teacher.important && (
                          <span className="text-[9px] bg-secondary-container text-on-secondary-container font-extrabold px-1 rounded">
                            VIP
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* CỘT PHẢI (8/12): KHUNG CHAT CHI TIẾT */}
          <div className="lg:col-span-8 flex flex-col h-full bg-surface-container-low/20">
            {activeTeacher ? (
              <>
                {/* Chat Header */}
                <div className="px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/20 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <img 
                      src={activeTeacher.avatar} 
                      alt={activeTeacher.name} 
                      className="w-10 h-10 rounded-full object-cover border border-outline-variant/20"
                    />
                    <div>
                      <p className="font-extrabold text-xs text-on-surface">{activeTeacher.name}</p>
                      <p className="text-[10px] text-primary font-bold">{activeTeacher.subject} — {activeTeacher.class}</p>
                      <p className="text-[9px] text-green-600 font-semibold flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        {activeTeacher.status}
                      </p>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => notify.success('Mô phỏng cuộc gọi thoại thoại...')}
                      className="p-2 hover:bg-surface-container rounded-xl text-on-surface-variant hover:text-on-surface"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => notify.success('Mô phỏng kết nối cuộc gọi video...')}
                      className="p-2 hover:bg-surface-container rounded-xl text-on-surface-variant hover:text-on-surface"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-surface-container rounded-xl text-on-surface-variant">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Khung tin nhắn */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface/50">
                  {currentChat.map(msg => {
                    const isParent = msg.sender === 'parent';
                    return (
                      <div 
                        key={msg.id}
                        className={`flex ${isParent ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className="max-w-[70%] space-y-1">
                          {/* Bong bóng chat */}
                          <div className={`p-4 rounded-2xl text-xs md:text-sm ${
                            isParent 
                              ? 'bg-primary text-on-primary rounded-tr-none shadow-sm' 
                              : 'bg-surface-container-lowest text-on-surface rounded-tl-none border border-outline-variant/15 shadow-sm'
                          }`}>
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            
                            {/* Attachment */}
                            {msg.attachment && (
                              <div className="mt-3 overflow-hidden rounded-xl border border-outline-variant/20 bg-surface">
                                {msg.attachment.type === 'image' ? (
                                  <img 
                                    src={msg.attachment.url} 
                                    alt={msg.attachment.name} 
                                    className="w-full max-h-48 object-cover cursor-zoom-in"
                                    onClick={() => window.open(msg.attachment?.url)}
                                  />
                                ) : (
                                  <div className="p-3 flex items-center gap-2 text-xs">
                                    <Paperclip className="w-4 h-4 text-primary" />
                                    <span className="font-semibold text-on-surface">{msg.attachment.name}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Time */}
                          <p className={`text-[9px] text-on-surface-variant/60 font-semibold px-2 ${
                            isParent ? 'text-right' : 'text-left'
                          }`}>
                            {msg.time}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Form gửi tin nhắn */}
                <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/20">
                  <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => notify.info('Tải lên ảnh đính kèm (Mockup).')}
                      className="p-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface transition-colors"
                      title="Đính kèm ảnh"
                    >
                      <Image className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => notify.info('Đính kèm tài liệu (Mockup).')}
                      className="p-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface transition-colors"
                      title="Đính kèm tài liệu"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    
                    <input
                      type="text"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      placeholder="Nhập tin nhắn phản hồi đến giáo viên..."
                      className="flex-grow px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-xs md:text-sm text-on-surface transition-all placeholder:text-on-surface-variant/45"
                    />

                    <button
                      type="submit"
                      className="p-2.5 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/95 transition-colors shadow-md shadow-primary/20 flex-shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  
                  {/* Footnote giáo dục */}
                  <div className="mt-2.5 flex items-center gap-1.5 text-[9px] text-on-surface-variant/75 font-semibold justify-center">
                    <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                    <span>Trao đổi lịch sự và tôn trọng giúp xây dựng môi trường giáo dục tốt hơn.</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <MessageSquare className="w-12 h-12 text-on-surface-variant/30 mb-4" />
                <h4 className="font-extrabold text-on-surface">Không tìm thấy giáo viên</h4>
                <p className="text-xs text-on-surface-variant mt-1.5">Vui lòng thử chọn một giáo viên khác bên cột trái.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
