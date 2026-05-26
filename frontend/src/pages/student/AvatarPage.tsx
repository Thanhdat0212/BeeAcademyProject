// ═══════════════════════════════════════════════════════════════════════════════
// TRANG ẢNH ĐẠI DIỆN — AvatarPage.tsx
//
// VỊ TRÍ TRONG HỆ THỐNG:
//   URL: /account/photo
//   Người dùng đến từ: Avatar dropdown header ➔ click "Ảnh" hoặc thanh Sidebar
//
// NỘI DUNG TRANG:
//   - Hiển thị ảnh đại diện hiện tại (đồng bộ từ useAuthStore).
//   - Vùng Kéo & Thả (Drag & Drop) hoặc click để chọn ảnh mới từ thiết bị.
//   - Hiển thị xem trước ảnh mới chọn trước khi quyết định bấm lưu.
//   - Gọi API thực tế POST /api/me/avatar để upload lên Supabase Storage và lưu vào DB.
//
// GIỚI HẠN & VALIDATION:
//   - Định dạng chấp nhận: jpeg, png, webp (accept="image/*").
//   - Dung lượng tối đa: 2MB (2,097,152 bytes) đồng bộ với backend.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Camera, Upload, Trash2, Image, Save } from 'lucide-react';
import DashboardHeader from '../../components/DashboardHeader';
import PageBanner from '../../components/PageBanner';
import { useAuthStore } from '../../store/useAuthStore';
import { uploadAvatar } from '../../api/authService';
import { isApiError } from '../../api/client';
import { notify } from '../../lib/toast';

export default function AvatarPage() {
  const user = useAuthStore(state => state.user);
  const updateUser = useAuthStore(state => state.updateUser);

  // ── State quản lý file ──────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fallback avatar tự động bằng initials nếu user chưa có avatarUrl
  const initialsAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? 'User')}&background=ffdbd1&color=ad2c00&bold=true&size=160`;
  const currentAvatar = user?.avatar ?? initialsAvatar;

  // ── Xử lý chọn tệp tin ──────────────────────────────────────────────────────
  const validateAndSetFile = (file: File) => {
    // 1. Kiểm tra định dạng (MIME type)
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(file.type)) {
      notify.error('Chỉ chấp nhận định dạng ảnh JPG, PNG hoặc WEBP!');
      return;
    }

    // 2. Kiểm tra dung lượng tối đa (2MB)
    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      notify.error('Dung lượng ảnh vượt quá giới hạn cho phép (Tối đa 2MB)!');
      return;
    }

    // 3. Hợp lệ ➔ lưu file và tạo url preview
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  // ── Xử lý Kéo & Thả (Drag & Drop) ──────────────────────────────────────────
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // ── Hủy chọn ảnh mới ──────────────────────────────────────────────────────
  const handleCancelSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ── Tiến hành tải ảnh lên server ───────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) {
      notify.error('Vui lòng chọn một tệp ảnh trước!');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    const toastId = notify.loading('Đang tải ảnh đại diện lên máy chủ...');

    try {
      // Gửi request multipart/form-data đến backend Spring Boot
      const response = await uploadAvatar(selectedFile);

      // Backend lưu ảnh thành công và trả về URL ảnh mới trong DB
      const newAvatarUrl = response.avatarUrl;

      // Cập nhật ngay lập tức vào Zustand Store của ứng dụng
      updateUser({ avatar: newAvatarUrl || undefined });

      notify.dismiss(toastId);
      notify.success('Cập nhật ảnh đại diện thành công!');

      // Dọn dẹp trạng thái preview tạm thời
      handleCancelSelection();
    } catch (err) {
      notify.dismiss(toastId);
      const errMsg = isApiError(err) ? err.message : 'Tải ảnh lên thất bại. Vui lòng thử lại sau.';
      notify.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <DashboardHeader />

      <PageBanner title="Ảnh đại diện" subtitle="Cập nhật hình ảnh hiển thị trên trang cá nhân" />

      {/* Nội dung chính */}
      <div className="flex-grow max-w-[1600px] mx-auto w-full px-4 md:px-10 py-8">
        <main className="max-w-2xl">
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden"
          >
            {/* Header card */}
            <div className="px-6 pt-6 pb-5 border-b border-outline-variant/20">
              <h2 className="text-lg font-extrabold text-on-surface">Thay đổi ảnh đại diện</h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Tải lên ảnh chân dung của bạn. Định dạng JPG, PNG hoặc WEBP tối đa 2MB.
              </p>
            </div>

            {/* Body card */}
            <div className="px-6 py-8 flex flex-col md:flex-row gap-8 items-center">
              
              {/* Cột 1: Hiển thị Preview vòng tròn lớn */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-teal-500/20 shadow-md">
                  <img
                    src={previewUrl || currentAvatar}
                    alt="Profile Avatar Preview"
                    className="w-full h-full object-cover"
                  />
                  {previewUrl && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-semibold">
                      Xem trước
                    </div>
                  )}
                </div>
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Ảnh hiển thị
                </span>
              </div>

              {/* Cột 2: Điều khiển chọn file & kéo thả */}
              <div className="flex-1 w-full space-y-4">
                
                {/* Drag-Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3
                    ${isDragActive ? 'border-teal-500 bg-teal-500/5' : 'border-outline-variant/60 hover:border-teal-500 hover:bg-surface-container-low'}
                    ${selectedFile ? 'border-solid border-teal-500/50 bg-teal-500/2' : ''}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {selectedFile ? (
                    <>
                      <div className="w-10 h-10 bg-teal-500/10 text-teal-600 rounded-xl flex items-center justify-center">
                        <Image className="w-5 h-5" />
                      </div>
                      <div className="text-sm font-semibold text-on-surface line-clamp-1">
                        {selectedFile.name}
                      </div>
                      <div className="text-xs text-on-surface-variant/80">
                        ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 bg-surface-container-high text-on-surface-variant/70 rounded-xl flex items-center justify-center">
                        <Camera className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-on-surface">
                        Kéo thả file ảnh vào đây hoặc click để chọn
                      </p>
                      <p className="text-xs text-on-surface-variant/60">
                        Chấp nhận JPG, PNG, WEBP tối đa 2MB
                      </p>
                    </>
                  )}
                </div>

                {/* Các nút hành động nhanh */}
                {selectedFile && (
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={handleCancelSelection}
                      className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant/80 text-on-surface-variant hover:text-red-500 hover:border-red-500/40 rounded-xl text-xs font-bold transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hủy chọn
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Footer card */}
            <div className="px-6 py-4 border-t border-outline-variant/20 flex justify-end">
              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-bold hover:bg-teal-600 active:bg-teal-700 transition-all shadow-sm shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Save className="w-4 h-4" />
                {submitting ? 'Đang tải lên...' : 'Lưu ảnh đại diện'}
              </button>
            </div>

          </motion.div>

        </main>
      </div>
    </div>
  );
}
