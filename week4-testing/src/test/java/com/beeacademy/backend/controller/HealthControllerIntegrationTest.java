package com.beeacademy.backend.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration Test cho HealthController.
 * Khoi dong toan bo Spring context + H2 in-memory.
 * Endpoint /api/health la public (khong can auth).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("HealthController Integration Tests")
class HealthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    // =========================================================================
    // IT01 — GET /api/health tra ve 200 OK
    // =========================================================================
    @Test
    @DisplayName("IT01: health_ShouldReturn200_WhenCalled")
    void health_ShouldReturn200_WhenCalled() throws Exception {
        mockMvc.perform(get("/api/health")
                .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.app").value("bee-academy-backend"))
                .andExpect(jsonPath("$.data.db").value("up"))
                .andExpect(jsonPath("$.data.status").value("ok"));
    }

    // =========================================================================
    // IT02 — /api/health khong yeu cau JWT (public endpoint)
    // =========================================================================
    @Test
    @DisplayName("IT02: health_ShouldReturn200_WithoutAuthentication")
    void health_ShouldReturn200_WithoutAuthentication() throws Exception {
        // Khong dung .with(authentication(...)) -> request khong co token
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk());
    }
}
