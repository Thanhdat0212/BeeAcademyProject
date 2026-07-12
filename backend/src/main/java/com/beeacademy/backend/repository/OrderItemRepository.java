package com.beeacademy.backend.repository;

import com.beeacademy.backend.model.OrderItem;
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

    @Query(value = """
           SELECT i.*
           FROM public.order_items i
           JOIN public.orders o ON o.id = i.order_id
           WHERE o.user_id = :studentId
             AND i.course_id = :courseId
             AND CAST(o.status AS text) = :status
           ORDER BY o.paid_at DESC
           """, nativeQuery = true)
    List<OrderItem> findPaidItemsByStudentAndCourse(@Param("studentId") UUID studentId,
                                                    @Param("courseId") UUID courseId,
                                                    @Param("status") String status);

    @Query(value = """
           SELECT DISTINCT i.course_id
           FROM public.order_items i
           JOIN public.orders o ON o.id = i.order_id
           WHERE o.user_id = :studentId
             AND CAST(o.status AS text) = :status
           """, nativeQuery = true)
    List<UUID> findPaidCourseIdsByStudent(@Param("studentId") UUID studentId,
                                          @Param("status") String status);
}
