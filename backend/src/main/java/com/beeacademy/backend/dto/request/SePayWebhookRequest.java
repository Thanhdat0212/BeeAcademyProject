package com.beeacademy.backend.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

// Payload SePay gửi về khi có giao dịch chuyển khoản vào tài khoản
public record SePayWebhookRequest(
    Long id,
    String gateway,
    @JsonProperty("transactionDate") String transactionDate,
    @JsonProperty("accountNumber") String accountNumber,
    String content,
    @JsonProperty("transferType") String transferType,
    @JsonProperty("transferAmount") Long transferAmount,
    @JsonProperty("referenceCode") String referenceCode,
    String description
) {}
