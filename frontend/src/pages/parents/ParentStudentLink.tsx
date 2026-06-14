import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, Trash2, Key, HelpCircle, CheckCircle2, 
  AlertTriangle, ShieldAlert, Award, User, RefreshCw
} from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore, LinkedStudent } from '../../store/useAuthStore';
import { notify } from '../../lib/toast';

export default function ParentStudentLink() {
  const { linkedStudents, unlinkStudent, fetchLinkedStudents } = useAuthStore();
  
  // State quản lý form
  const [loading, setLoading] = useState(false);
  
  // State xác nhận gỡ liên kết học sinh
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);

  // Tải danh sách con cái từ API thật khi component mount
  useEffect(() => {
    fetchLinkedStudents();
  }, [fetchLinkedStudents]);



  // Xác nhận gỡ liên kết
  const handleConfirmUnlink = (id: string) => {
    setConfirmUnlinkId(id);
  };

  const handleExecuteUnlink = async () => {
    if (!confirmUnlinkId) return;
    
    const student = linkedStudents.find(s => s.id === confirmUnlinkId);
    
    setLoading(true);
    const result = await unlinkStudent(confirmUnlinkId);
    setLoading(false);
    
    if (typeof result === 'string') {
      notify.error(result);
    } else {
      notify.success(`Đã gỡ liên kết tài khoản con ${student?.name}`);
    }
    setConfirmUnlinkId(null);
  };


  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />
      
      <PageBanner 
        title="Liên kết tài khoản con" 
        subtitle="Quản lý mã liên kết học sinh để giám sát tiến trình học tập của các con" 
      />

      {/* Main Container */}
      <div className="flex-grow max-w-[1000px] mx-auto w-full px-4 md:px-10 py-8">
        <div className="space-y-8">
          
          {/* DANH SÁCH CÁC CON ĐÃ LIÊN KẾT */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-sm flex flex-col min-h-[400px]">
            <div className="border-b border-outline-variant/20 pb-4 mb-5">
              <h3 className="font-extrabold text-on-surface text-base">
                Danh sách con đang liên kết ({linkedStudents.length})
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Các tài khoản học sinh đã kết nối với tài khoản giám sát của bạn
              </p>
            </div>

            {/* List học sinh */}
            <div className="flex-grow space-y-4">
              {linkedStudents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center mb-3">
                    <User className="w-6 h-6 text-on-surface-variant/40" />
                  </div>
                  <p className="text-xs text-on-surface-variant">Không có học sinh nào đang được liên kết.</p>
                </div>
              ) : (
                linkedStudents.map(student => (
                  <div 
                    key={student.id}
                    className="p-4 bg-surface-container-low/40 border border-outline-variant/15 rounded-2xl flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={student.avatar} 
                        alt={student.name} 
                        className="w-12 h-12 rounded-full border border-outline-variant/20 object-cover flex-shrink-0 bg-surface-container"
                      />
                      <div>
                        <h4 className="font-extrabold text-xs md:text-sm text-on-surface">{student.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-on-surface-variant font-semibold">
                            Lớp: {student.grade}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConfirmUnlink(student.id)}
                      className="p-2.5 bg-red-50 hover:bg-red-100/50 text-red-500 rounded-xl transition-colors border border-red-200/30 flex-shrink-0"
                      title="Gỡ liên kết"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
          </div>
        </div>
      </div>
    </div>

      {/* MODAL CONFIRM UNLINK */}
      <AnimatePresence>
        {confirmUnlinkId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-6"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-sm md:text-base text-on-surface">Gỡ liên kết học sinh?</h4>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed">
                Hành động này sẽ ngắt kết nối tài khoản giám sát của bạn với học sinh{' '}
                <strong className="text-on-surface">
                  {linkedStudents.find(s => s.id === confirmUnlinkId)?.name}
                </strong>
                . Bạn sẽ không thể tiếp tục theo dõi tiến độ và nhận xét học tập của con nữa.
              </p>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmUnlinkId(null)}
                  className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold text-on-surface-variant transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleExecuteUnlink}
                  className="px-4 py-2.5 bg-red-500 text-white hover:bg-red-600 rounded-xl text-xs font-bold transition-all shadow-md shadow-red-500/20"
                >
                  Xác nhận gỡ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
