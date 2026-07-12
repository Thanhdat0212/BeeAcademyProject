package com.beeacademy.e2e.tests;

import com.beeacademy.e2e.base.BaseTest;
import com.beeacademy.e2e.pages.LoginPage;
import com.beeacademy.e2e.utils.ConfigReader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Task 45 — Automate luồng 1: Đăng nhập.
 *
 * Yêu cầu để chạy: backend(:8080) + frontend(:3000) đang chạy và có tài khoản test.
 * Tài khoản đọc từ config (testEmail/testPassword) — override khi chạy:
 *   .\mvnw.cmd test "-Dtest=LoginTest" "-DtestEmail=..." "-DtestPassword=..."
 *
 * Nếu app chưa chạy, test tự SKIP (assumeAppIsRunning) để không làm đỏ CI.
 */
class LoginTest extends BaseTest {

    private LoginPage loginPage;

    @BeforeEach
    void openLogin() {
        assumeAppIsRunning();
        loginPage = new LoginPage(driver, baseUrl).open();
    }

    @Test
    @DisplayName("Đăng nhập thành công -> điều hướng rời khỏi trang /login")
    void loginSuccess_redirectsToHome() {
        String email = ConfigReader.get("testEmail");
        String password = ConfigReader.get("testPassword");
        boolean usingPlaceholder = email == null || email.isBlank()
                || email.equalsIgnoreCase("test@example.com");

        loginPage.login(email, password);
        boolean success = loginPage.loginSucceeded();

        // Voi tai khoan placeholder mac dinh (chua truyen -DtestEmail/-DtestPassword that)
        // thi SKIP thay vi fail. Khi truyen tai khoan that, dang nhap PHAI thanh cong.
        if (usingPlaceholder) {
            assumeTrue(success,
                    "Skip: chua cung cap tai khoan that qua -DtestEmail/-DtestPassword (placeholder khong dang nhap duoc).");
        }

        assertFalse(loginPage.isOnLoginPage(),
                "Sau khi đăng nhập đúng, không còn ở /login. URL hiện tại: " + loginPage.currentUrl());
    }

    @Test
    @DisplayName("Đăng nhập sai mật khẩu -> vẫn ở lại /login")
    void loginWrongPassword_staysOnLogin() {
        String email = ConfigReader.get("testEmail");

        loginPage.login(email, "SaiMatKhau_" + System.currentTimeMillis());

        // Không điều hướng đi đâu: chờ ngắn rồi xác nhận vẫn ở /login (BE trả lỗi -> toast).
        boolean stillOnLogin = waitStaysOnLogin();
        assertTrue(stillOnLogin,
                "Đăng nhập sai phải ở lại /login. URL hiện tại: " + loginPage.currentUrl());
    }

    /** Quan sát trong ~4s rằng app KHÔNG điều hướng rời /login (không dùng Thread.sleep cố định). */
    private boolean waitStaysOnLogin() {
        long deadline = System.currentTimeMillis() + 4000;
        while (System.currentTimeMillis() < deadline) {
            if (!loginPage.isOnLoginPage()) {
                return false;
            }
        }
        return loginPage.isOnLoginPage();
    }
}
