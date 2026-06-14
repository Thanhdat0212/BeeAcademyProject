package com.beeacademy.backend.config;

import org.springframework.context.annotation.Configuration;

// PayOS credentials are injected via @Value in OrderService and PayOSWebhookController.
// Direct HTTP calls replace the SDK to avoid CheckoutResponseData deserialization issues.
@Configuration
public class PayOSConfig {
}
