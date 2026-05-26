package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Profile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
     */
    @Query(value = "SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = :email)", nativeQuery = true)
    boolean existsByEmailInAuth(@Param("email") String email);

    /**
     * Lấy UUID của user từ email trong bảng auth.users.
     */
    @Query(value = "SELECT id FROM auth.users WHERE email = :email", nativeQuery = true)
    Optional<UUID> findUserIdByEmail(@Param("email") String email);
}
