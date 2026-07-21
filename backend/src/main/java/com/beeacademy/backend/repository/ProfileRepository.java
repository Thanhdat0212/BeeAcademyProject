package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Truy vấn bảng {@code public.profiles}.
 *
 * <p>Kế thừa {@link JpaRepository} đã cung cấp sẵn:
 * <ul>
 *   <li>{@code save(profile)} - INSERT hoặc UPDATE</li>
 *   <li>{@code findById(uuid)} - trả về Optional</li>
 *   <li>{@code existsById(uuid)} - check sự tồn tại không load entity</li>
 *   <li>{@code deleteById(uuid)}</li>
 * </ul>
 *
 * <p>Hiện tại chưa cần custom query - sẽ thêm khi service cần truy vấn
 * theo điều kiện đặc biệt (vd: {@code findByRole}).
 */
@Repository
public interface ProfileRepository extends JpaRepository<Profile, UUID> {

    /**
     * Kiểm tra xem email có tồn tại trong bảng auth.users của Supabase không.
     *
     * <p>So sánh LOWER() hai phía vì Supabase chuẩn hóa email về lowercase khi
     * tạo user, còn input từ client có thể viết hoa — so sánh exact sẽ bỏ sót.
     */
    @Query(value = "SELECT EXISTS(SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER(:email))", nativeQuery = true)
    boolean existsByEmailInAuth(@Param("email") String email);

    /**
     * Lấy UUID của user từ email trong bảng auth.users.
     * LOWER() hai phía — cùng lý do với {@link #existsByEmailInAuth}.
     */
    @Query(value = "SELECT id FROM auth.users WHERE LOWER(email) = LOWER(:email)", nativeQuery = true)
    Optional<UUID> findUserIdByEmail(@Param("email") String email);

    @Query(value = "SELECT email FROM auth.users WHERE id = :userId", nativeQuery = true)
    Optional<String> findEmailByUserId(@Param("userId") UUID userId);

    /**
     * Admin: danh sách user với tìm kiếm và filter role.
     * Join auth.users để lấy email.
     *
     * <p>{@code AdminUserResponse.fromRow} đọc kết quả theo CHỈ SỐ VỊ TRÍ —
     * cột mới phải thêm vào cuối SELECT, không được chèn vào giữa.
     */
    @Query(value = """
        SELECT id, full_name, avatar_url, role, is_blocked, created_at, email,
               teacher_approval_status, must_change_password
        FROM public.profiles_with_email
        WHERE (:role = '' OR role = :role)
          AND (:search = ''
               OR LOWER(full_name) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(email)     LIKE LOWER(CONCAT('%', :search, '%')))
        ORDER BY created_at DESC
        """,
        countQuery = """
        SELECT COUNT(*)
        FROM public.profiles_with_email
        WHERE (:role = '' OR role = :role)
          AND (:search = ''
               OR LOWER(full_name) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(email)     LIKE LOWER(CONCAT('%', :search, '%')))
        """,
        nativeQuery = true)
    Page<Object[]> findAllWithEmail(@Param("role") String role,
                                    @Param("search") String search,
                                    Pageable pageable);

    long countByRole(UserRole role);

    List<Profile> findByRole(UserRole role);

    /**
     * Số người dùng mới theo tháng (Admin Reports — UC37). Mỗi row:
     * [String month("yyyy-MM"), Long count]. {@code to_char} bucket theo
     * {@code created_at}; GROUP BY 1 = theo cột output đầu tiên.
     */
    @Query(value = "SELECT to_char(created_at, 'YYYY-MM') AS m, COUNT(*) " +
                   "FROM public.profiles GROUP BY 1 ORDER BY 1", nativeQuery = true)
    List<Object[]> userGrowthByMonth();
}
