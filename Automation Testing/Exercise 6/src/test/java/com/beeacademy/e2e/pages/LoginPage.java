package com.beeacademy.e2e.pages;

import com.beeacademy.e2e.base.BasePage;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;

/**
 * Page Object cho trang Đăng nhập (/login).
 *
 * Form login hiện CHƯA có id/name/data-testid (xem frontend/src/pages/common/Login.tsx),
 * nên dùng CSS selector theo type — ổn định vì form chỉ có đúng 1 input mỗi loại.
 * Khi FE thêm data-testid, đổi locator sang data-testid cho bền hơn.
 */
public class LoginPage extends BasePage {

    private static final By EMAIL_INPUT = By.cssSelector("form input[type='email']");
    private static final By PASSWORD_INPUT = By.cssSelector("form input[type='password']");
    private static final By SUBMIT_BUTTON = By.cssSelector("form button[type='submit']");

    private final String baseUrl;

    public LoginPage(WebDriver driver, String baseUrl) {
        super(driver);
        this.baseUrl = baseUrl;
    }

    public LoginPage open() {
        driver.get(baseUrl + "/login");
        waitVisible(EMAIL_INPUT);
        return this;
    }

    public void login(String email, String password) {
        type(EMAIL_INPUT, email);
        type(PASSWORD_INPUT, password);
        click(SUBMIT_BUTTON);
    }

    /** Chờ app điều hướng RA KHỎI /login (đăng nhập thành công). */
    public void waitUntilRedirectedAwayFromLogin() {
        wait.until(ExpectedConditions.not(ExpectedConditions.urlContains("/login")));
    }

    /**
     * Trả về true nếu đăng nhập thành công (rời khỏi /login trong thời gian chờ).
     * Dùng để E2E flow phụ thuộc đăng nhập có thể SKIP thay vì ERROR khi
     * tài khoản seed chưa hợp lệ — đúng triết lý skip của BaseTest.
     */
    public boolean loginSucceeded() {
        try {
            waitUntilRedirectedAwayFromLogin();
            return true;
        } catch (TimeoutException e) {
            return false;
        }
    }

    public boolean isOnLoginPage() {
        return driver.getCurrentUrl().contains("/login");
    }

    public String currentUrl() {
        return driver.getCurrentUrl();
    }
}
