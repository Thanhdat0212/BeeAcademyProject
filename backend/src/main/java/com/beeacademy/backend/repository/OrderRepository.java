package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.Order;
import com.beeacademy.backend.model.OrderStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    Optional<Order> findByOrderCode(Long orderCode);

    @Query("SELECT DISTINCT o FROM Order o LEFT JOIN FETCH o.items WHERE o.userId = :userId ORDER BY o.createdAt DESC")
    List<Order> findByUserIdWithItems(@Param("userId") UUID userId);

    /**
     * N đơn gần nhất theo trạng thái (truyền PageRequest.of(0, N)).
     * COALESCE vì paid_at có thể NULL ở dữ liệu cũ — DESC thuần sẽ đẩy
     * NULL lên đầu trong Postgres. Không JOIN FETCH items: fetch-join +
     * Pageable buộc Hibernate phân trang in-memory; items được batch-load
     * riêng qua {@link OrderItemRepository#findByOrder_IdIn}.
     */
    @Query("SELECT o FROM Order o WHERE o.status = :status " +
           "ORDER BY COALESCE(o.paidAt, o.createdAt) DESC")
    List<Order> findRecentByStatus(@Param("status") OrderStatus status, Pageable pageable);
}
