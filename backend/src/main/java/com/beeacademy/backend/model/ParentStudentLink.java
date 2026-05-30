package com.beeacademy.backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/**
 * Entity đại diện cho mối liên kết giữa Phụ huynh (Parent) và Học sinh (Student).
 * 
 * <p>Mỗi bản ghi ánh xạ mối quan hệ 1-N hoặc N-N từ bảng {@code parent_student_links}.
 * Sử dụng khóa chính tổ hợp {@link Id} để đảm bảo tính duy nhất của mối liên kết giữa phụ huynh và con.
 */
@Entity
@Table(name = "parent_student_links")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED) // JPA cần constructor không tham số
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class ParentStudentLink {

    /**
     * Khóa chính tổ hợp chứa parentId và studentId
     */
    @EmbeddedId
    private Id id;


    /**
     * Đối tượng Phụ huynh trong liên kết (liên kết đến profiles)
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("parentId")
    @JoinColumn(name = "parent_id", nullable = false)
    private Profile parent;

    /**
     * Đối tượng Học sinh (con) trong liên kết (liên kết đến profiles)
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("studentId")
    @JoinColumn(name = "student_id", nullable = false)
    private Profile student;

    // ========================================================================
    // Khóa chính tổ hợp (Composite Primary Key Class)
    // ========================================================================
    
    /**
     * Lớp nhúng định nghĩa khóa chính tổ hợp gồm ID phụ huynh và ID học sinh.
     * Cần implements Serializable và override equals/hashCode theo chuẩn JPA.
     */
    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Id implements Serializable {

        private static final long serialVersionUID = 1L;

        @Column(name = "parent_id")
        private UUID parentId;

        @Column(name = "student_id")
        private UUID studentId;
    }

    // ========================================================================
    // Factory method (Rich Domain Model)
    // ========================================================================

    /**
     * Phương thức khởi tạo thực thể liên kết mới
     * 
     * @param parent  Đối tượng Profile phụ huynh
     * @param student Đối tượng Profile học sinh
     * @return Thực thể liên kết ParentStudentLink mới
     */
    public static ParentStudentLink createLink(Profile parent, Profile student) {
        if (parent == null || student == null) {
            throw new IllegalArgumentException("Hồ sơ phụ huynh và học sinh không được null khi tạo liên kết.");
        }
        
        Id linkId = new Id(parent.getId(), student.getId());
        
        return ParentStudentLink.builder()
                .id(linkId)
                .parent(parent)
                .student(student)
                .build();
    }
}
