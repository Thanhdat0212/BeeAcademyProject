# BE3: Profile, Password Management & Google OAuth Sync (UC04, UC05)

## 📋 Nhiệm vụ chính
1. **Quản lý Hồ sơ (Profile):** Endpoint lấy thông tin profile hiện tại, cập nhật thông tin cá nhân và links mạng xã hội.
2. **Upload ảnh đại diện:** Tiếp nhận tệp ảnh (`MultipartFile`), validate định dạng (JPEG/PNG/WEBP) và dung lượng tối đa 2MB, tải lên Supabase Storage và cập nhật URL vào database.
3. **Quản lý Mật khẩu:** Tính năng Quên mật khẩu (gửi OTP phục hồi và đặt lại mật khẩu mới) và Đổi mật khẩu trong cài đặt.
4. **Google OAuth Sync:** Đồng bộ thông tin profile sau khi người dùng đăng nhập thành công bằng tài khoản Google.

## 📂 Danh sách các file trong thư mục của bạn
* `ProfileController.java`: Endpoints lấy/sửa profile (`GET/PUT /api/me`) và upload avatar (`POST /api/me/avatar`).
* `ProfileService.java`: Logic nghiệp vụ lưu trữ, kiểm tra file ảnh đại diện và lưu đường dẫn.
* `SupabaseStorageClient.java`: Client tải file binary lên public bucket `avatars` của Supabase.
* `Profile.java`: Model Entity ánh xạ bảng `profiles` Postgres trên Supabase.
* `ProfileRepository.java`: JPA Repository để tương tác dữ liệu bảng `profiles`.
* `AuthController.java` & `AuthService.java`: Nơi chứa logic đổi mật khẩu (`changePassword`), reset mật khẩu (`verifyOtpAndResetPassword`) và đồng bộ Google (`syncOAuthProfile`).
* **Các DTO payloads:**
  * `UpdateProfileRequest.java` / `ProfileResponse.java`
  * `ChangePasswordRequest.java` / `ResetPasswordRequest.java` / `VerifyResetPasswordOtpRequest.java`
  * `OAuthSyncRequest.java`
  * `ApiResponse.java` (Format dữ liệu phản hồi API chuẩn)
