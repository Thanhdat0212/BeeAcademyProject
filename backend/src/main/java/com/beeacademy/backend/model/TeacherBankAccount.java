package com.beeacademy.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "teacher_bank_accounts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TeacherBankAccount {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "teacher_id", nullable = false, updatable = false)
    private UUID teacherId;

    @Column(name = "bank_name", nullable = false)
    private String bankName;

    @Column(name = "account_number", nullable = false)
    private String accountNumber;

    @Column(name = "account_holder", nullable = false)
    private String accountHolder;

    @Column(name = "branch")
    private String branch;

    @Convert(converter = BankVerifyStatusConverter.class)
    @ColumnTransformer(read = "verify_status::text", write = "?::bank_verify_status")
    @Column(name = "verify_status", nullable = false)
    private BankVerifyStatus verifyStatus;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static TeacherBankAccount create(UUID teacherId, String bankName,
                                             String accountNumber, String accountHolder,
                                             String branch) {
        TeacherBankAccount b = new TeacherBankAccount();
        b.id = UUID.randomUUID();
        b.teacherId = teacherId;
        b.bankName = bankName;
        b.accountNumber = accountNumber;
        b.accountHolder = accountHolder;
        b.branch = branch;
        b.verifyStatus = BankVerifyStatus.PENDING;
        b.createdAt = Instant.now();
        return b;
    }

    public void update(String bankName, String accountNumber,
                       String accountHolder, String branch) {
        this.bankName = bankName;
        this.accountNumber = accountNumber;
        this.accountHolder = accountHolder;
        this.branch = branch;
        this.verifyStatus = BankVerifyStatus.PENDING;
    }
}
