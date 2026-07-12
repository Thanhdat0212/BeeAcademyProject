package com.beeacademy.e2e.pages;

import com.beeacademy.e2e.base.BasePage;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.util.List;

/**
 * Page Object for the public course detail page.
 *
 * Flow 3 focuses on the app's core action: a student opens a course and starts
 * the enrollment/purchase/learning action.
 */
public class CourseDetailPage extends BasePage {

    private static final By PAGE_ROOT = By.cssSelector("main, [role='main'], body");
    private static final By MAIN_COURSE_ACTION = By.xpath(
            "//*[@data-testid='enroll-button' or @data-testid='buy-course-button' " +
            "or @data-testid='course-primary-action' or @data-testid='checkout-button' " +
            "or self::button or self::a]" +
            "[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'enroll') " +
            "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'register') " +
            "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'buy') " +
            "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'checkout') " +
            "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'start learning') " +
            "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') " +
            "or contains(normalize-space(.), 'Đăng ký') " +
            "or contains(normalize-space(.), 'Dang ky') " +
            "or contains(normalize-space(.), 'Ghi danh') " +
            "or contains(normalize-space(.), 'Mua') " +
            "or contains(normalize-space(.), 'Thanh toán') " +
            "or contains(normalize-space(.), 'Thanh toan') " +
            "or contains(normalize-space(.), 'Học ngay') " +
            "or contains(normalize-space(.), 'Hoc ngay') " +
            "or contains(normalize-space(.), 'Vào học') " +
            "or contains(normalize-space(.), 'Vao hoc')]");
    private static final By ENROLLED_OR_SUCCESS_STATE = By.xpath(
            "//*[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'enrolled') " +
            "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'success') " +
            "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'cart') " +
            "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'my courses') " +
            "or contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') " +
            "or contains(normalize-space(.), 'Đã đăng ký') " +
            "or contains(normalize-space(.), 'Da dang ky') " +
            "or contains(normalize-space(.), 'Đã mua') " +
            "or contains(normalize-space(.), 'Da mua') " +
            "or contains(normalize-space(.), 'Thành công') " +
            "or contains(normalize-space(.), 'Thanh cong') " +
            "or contains(normalize-space(.), 'Giỏ hàng') " +
            "or contains(normalize-space(.), 'Gio hang') " +
            "or contains(normalize-space(.), 'Khóa học của tôi') " +
            "or contains(normalize-space(.), 'Khoa hoc cua toi') " +
            "or contains(normalize-space(.), 'Vào học') " +
            "or contains(normalize-space(.), 'Vao hoc')]");

    public CourseDetailPage(WebDriver driver) {
        super(driver);
    }

    public CourseDetailPage waitUntilLoaded() {
        waitVisible(PAGE_ROOT);
        wait.until(d -> isOnCourseDetailPage());
        return this;
    }

    public boolean isOnCourseDetailPage() {
        String currentUrl = driver.getCurrentUrl();
        return currentUrl.contains("/courses/") && !currentUrl.endsWith("/courses");
    }

    public boolean hasMainCourseAction() {
        return visibleElements(MAIN_COURSE_ACTION).size() > 0;
    }

    public boolean hasEnrolledOrSuccessState() {
        return visibleElements(ENROLLED_OR_SUCCESS_STATE).size() > 0
                || currentUrlLooksLikeCourseProgress();
    }

    public void clickMainCourseAction() {
        WebElement action = waitClickable(MAIN_COURSE_ACTION);
        String beforeUrl = driver.getCurrentUrl();
        String beforeActionText = action.getText();
        action.click();
        wait.until(d -> !driver.getCurrentUrl().equals(beforeUrl)
                || hasEnrolledOrSuccessState()
                || !firstVisibleActionText().equals(beforeActionText));
    }

    public boolean actionCompletedOrProgressed() {
        return hasEnrolledOrSuccessState()
                || currentUrlLooksLikeCourseProgress();
    }

    public String currentUrl() {
        return driver.getCurrentUrl();
    }

    private List<WebElement> visibleElements(By locator) {
        return driver.findElements(locator).stream()
                .filter(WebElement::isDisplayed)
                .toList();
    }

    private String firstVisibleActionText() {
        return visibleElements(MAIN_COURSE_ACTION).stream()
                .findFirst()
                .map(WebElement::getText)
                .orElse("");
    }

    private boolean currentUrlLooksLikeCourseProgress() {
        String currentUrl = driver.getCurrentUrl().toLowerCase();
        return currentUrl.contains("checkout")
                || currentUrl.contains("payment")
                || currentUrl.contains("order")
                || currentUrl.contains("cart")
                || currentUrl.contains("learn")
                || currentUrl.contains("my-courses")
                || currentUrl.contains("me/courses");
    }
}
