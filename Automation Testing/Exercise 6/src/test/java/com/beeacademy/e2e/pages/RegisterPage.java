package com.beeacademy.e2e.pages;

import com.beeacademy.e2e.base.BasePage;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/**
 * Page Object cho trang Đăng ký (/register) — chức năng #2 của Exercise 6.
 *
 * Form step 1 (xem frontend/src/pages/common/Register.tsx) validate client-side trong
 * validateForm(): họ tên ≥2 ký tự, email bắt buộc, mật khẩu regex (?=.*[A-Z])(?=.*\d).{8,}.
 * Nếu sai -> toast lỗi và Ở LẠI step 1. Nếu đúng -> requestOtp() -> chuyển step 2 (6 ô OTP).
 *
 * Vì step 2 cần OTP email thật, ta chỉ kiểm thử VALIDATION (các ca âm) — không cần backend/OTP.
 * Locator dùng CSS theo type vì form chỉ có đúng 1 input mỗi loại ở step 1.
 */
public class RegisterPage extends BasePage {

    private static final By FULLNAME_INPUT = By.cssSelector("form input[type='text']");
    private static final By EMAIL_INPUT = By.cssSelector("form input[type='email']");
    private static final By PASSWORD_INPUT = By.cssSelector("form input[type='password']");
    private static final By SUBMIT_BUTTON = By.cssSelector("form button[type='submit']");
    // 6 ô OTP chỉ xuất hiện ở step 2 (input inputmode='numeric', maxlength=1)
    private static final By OTP_INPUTS = By.cssSelector("input[inputmode='numeric']");

    private final String baseUrl;

    public RegisterPage(WebDriver driver, String baseUrl) {
        super(driver);
        this.baseUrl = baseUrl;
    }

    public RegisterPage open() {
        driver.get(baseUrl + "/register");
        waitVisible(FULLNAME_INPUT);
        return this;
    }

    /** Điền step 1 rồi bấm "Gửi mã xác thực". Field rỗng -> bỏ qua (giữ trống). */
    public void fillStep1(String fullName, String email, String password) {
        if (fullName != null) type(FULLNAME_INPUT, fullName);
        if (email != null) type(EMAIL_INPUT, email);
        if (password != null) type(PASSWORD_INPUT, password);
        click(SUBMIT_BUTTON);
    }

    /** Còn ở step 1 nếu input email của step 1 vẫn hiển thị (chưa chuyển qua OTP). */
    public boolean isStillOnStep1() {
        return isDisplayed(EMAIL_INPUT);
    }

    /** Đã sang step 2 nếu xuất hiện đủ 6 ô OTP. */
    public boolean otpStepAppeared() {
        try {
            return driver.findElements(OTP_INPUTS).size() == 6;
        } catch (Exception e) {
            return false;
        }
    }
}
