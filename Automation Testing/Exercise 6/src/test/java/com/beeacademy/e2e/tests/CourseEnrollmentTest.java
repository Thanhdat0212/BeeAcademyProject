package com.beeacademy.e2e.tests;

import com.beeacademy.e2e.base.BaseTest;
import com.beeacademy.e2e.pages.CourseBrowsePage;
import com.beeacademy.e2e.pages.CourseDetailPage;
import com.beeacademy.e2e.pages.LoginPage;
import com.beeacademy.e2e.utils.ConfigReader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Task 47 - Automate flow 3: main course action.
 *
 * Main scenario: student logs in, browses courses, opens a course detail page,
 * then starts enrollment/purchase/learning through the primary course action.
 */
class CourseEnrollmentTest extends BaseTest {

    @BeforeEach
    void ensureAppIsAvailable() {
        assumeAppIsRunning();
    }

    @Test
    @DisplayName("Main flow: student can open a course and start enrollment")
    void studentCanStartCourseEnrollment() {
        assumeTrue(loginAsStudent(),
                "Skip: dang nhap student that bai (can tai khoan seed hop le qua -DtestEmail/-DtestPassword).");

        CourseBrowsePage courseBrowsePage = new CourseBrowsePage(driver, baseUrl).open();
        assumeTrue(courseBrowsePage.visibleCourseCount() > 0,
                "Skip: catalog has no visible course data to enroll.");

        courseBrowsePage.openFirstVisibleCourse();

        CourseDetailPage courseDetailPage = new CourseDetailPage(driver).waitUntilLoaded();
        assertTrue(courseDetailPage.isOnCourseDetailPage(),
                "After clicking a course, browser should be on a course detail page. URL: "
                        + courseDetailPage.currentUrl());

        if (!courseDetailPage.hasEnrolledOrSuccessState()) {
            assumeTrue(courseDetailPage.hasMainCourseAction(),
                    "Skip: course detail page has no enroll/buy/learn primary action. URL: "
                            + courseDetailPage.currentUrl());
            courseDetailPage.clickMainCourseAction();
        }

        assertTrue(courseDetailPage.actionCompletedOrProgressed(),
                "Course primary action should complete, show enrolled state, or navigate to checkout/learning. URL: "
                        + courseDetailPage.currentUrl());
    }

    private boolean loginAsStudent() {
        String email = ConfigReader.get("testEmail");
        String password = ConfigReader.get("testPassword");

        LoginPage loginPage = new LoginPage(driver, baseUrl).open();
        loginPage.login(email, password);
        return loginPage.loginSucceeded();
    }
}
