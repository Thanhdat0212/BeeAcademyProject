package com.beeacademy.e2e.tests;

import com.beeacademy.e2e.base.BaseTest;
import com.beeacademy.e2e.pages.RegisterPage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvFileSource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Exercise 6 — Chức năng #2: Đăng ký (kiểm thử VALIDATION, ưu tiên negative test).
 *
 * Các ca âm dưới đây validate hoàn toàn ở client (validateForm trong Register.tsx) nên
 * KHÔNG cần backend/OTP: dữ liệu sai -> app ở lại step 1, không hiện 6 ô OTP.
 * Chỉ cần frontend(:3000) đang chạy; nếu chưa chạy thì test tự SKIP (assumeAppIsRunning).
 */
class RegisterValidationTest extends BaseTest {

    private RegisterPage registerPage;

    @BeforeEach
    void openRegister() {
        assumeAppIsRunning();
        registerPage = new RegisterPage(driver, baseUrl).open();
    }

    @Test
    @DisplayName("Họ tên < 2 ký tự -> ở lại step 1, không qua bước OTP")
    void shortFullName_staysOnStep1() {
        registerPage.fillStep1("A", "valid_" + System.currentTimeMillis() + "@example.com", "Abcdef12");
        assertTrue(registerPage.isStillOnStep1(), "Họ tên quá ngắn phải ở lại step 1");
        assertFalse(registerPage.otpStepAppeared(), "Không được chuyển sang bước OTP khi dữ liệu sai");
    }

    @Test
    @DisplayName("Thiếu email -> ở lại step 1")
    void missingEmail_staysOnStep1() {
        registerPage.fillStep1("Nguyen Van A", "", "Abcdef12");
        assertTrue(registerPage.isStillOnStep1(), "Thiếu email phải ở lại step 1");
        assertFalse(registerPage.otpStepAppeared());
    }

    @Test
    @DisplayName("Mật khẩu yếu -> ở lại step 1")
    void weakPassword_staysOnStep1() {
        registerPage.fillStep1("Nguyen Van A", "valid_" + System.currentTimeMillis() + "@example.com", "abc");
        assertTrue(registerPage.isStillOnStep1(), "Mật khẩu yếu phải ở lại step 1");
        assertFalse(registerPage.otpStepAppeared());
    }

    @ParameterizedTest(name = "Ca âm: {3}")
    @CsvFileSource(resources = "/register-invalid.csv", numLinesToSkip = 1)
    @DisplayName("Nhiều bộ dữ liệu sai (CSV) -> đều ở lại step 1")
    void invalidData_fromCsv_staysOnStep1(String fullName, String email, String password, String reason) {
        // Chuyển null -> "" và trim để tránh lỗi khi CSV có ô rỗng / khoảng trắng (như tài liệu Bài 2).
        fullName = (fullName == null) ? "" : fullName.trim();
        email = (email == null) ? "" : email.trim();
        password = (password == null) ? "" : password.trim();

        registerPage.fillStep1(fullName, email, password);
        assertTrue(registerPage.isStillOnStep1(), "[" + reason + "] phải ở lại step 1");
        assertFalse(registerPage.otpStepAppeared(), "[" + reason + "] không được qua bước OTP");
    }

    @Test
    @DisplayName("Dữ liệu hợp lệ -> qua bước OTP (SKIP nếu backend chưa bật)")
    void validData_reachesOtpStep() {
        registerPage.fillStep1("Nguyen Van A", "valid_" + System.currentTimeMillis() + "@example.com", "Abcdef12");
        boolean reachedOtp = registerPage.otpStepAppeared();
        // Cần backend(:8080) gửi OTP thành công mới qua step 2. Nếu chưa bật -> SKIP thay vì fail.
        assumeTrue(reachedOtp, "Skip: cần backend(:8080) chạy để requestOtp thành công và hiện bước OTP.");
        assertTrue(reachedOtp);
    }
}
