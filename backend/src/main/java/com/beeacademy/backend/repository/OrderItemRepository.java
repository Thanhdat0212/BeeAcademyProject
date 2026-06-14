package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.OrderItem;
import com.beeacademy.backend.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    List<OrderItem> findByOrderId(UUID orderId);

    /** Batch-load items của nhiều đơn cùng lúc — tránh N+1 khi build danh sách đơn gần đây. */
    List<OrderItem> findByOrder_IdIn(Collection<UUID> orderIds);

    @Query("SELECT i FROM OrderItem i JOIN FETCH i.order o " +
           "WHERE o.userId = :studentId AND i.courseId = :courseId AND o.status = :status " +
           "ORDER BY o.paidAt DESC")
    List<OrderItem> findPaidItemsByStudentAndCourse(@Param("studentId") UUID studentId,
                                                    @Param("courseId") UUID courseId,
                                                    @Param("status") OrderStatus status);
}
