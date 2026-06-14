package com.beeacademy.backend.model;

import org.hibernate.type.descriptor.java.EnumJavaType;

/**
 * Hibernate JavaType cho {@link UserRole} — xử lý chuyển đổi case giữa
 * Java (STUDENT) và Postgres native enum user_role (student).
 *
 * Dùng cùng {@code @JdbcTypeCode(SqlTypes.NAMED_ENUM)} để Hibernate vẫn
 * gửi đúng kiểu native enum cho Postgres, nhưng toName/fromName được
 * override để map lowercase ↔ uppercase.
 */
public class UserRoleJavaType extends EnumJavaType<UserRole> {

    public UserRoleJavaType() {
        super(UserRole.class);
    }

    @Override
    public String toName(UserRole value) {
        return value != null ? value.toDbValue() : null;
    }

    @Override
    public UserRole fromName(String name) {
        return UserRole.fromDbValue(name);
    }
}
