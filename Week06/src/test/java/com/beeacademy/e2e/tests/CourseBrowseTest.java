package com.beeacademy.e2e.tests;

import com.beeacademy.e2e.base.BaseTest;
import com.beeacademy.e2e.pages.CourseBrowsePage;
import com.beeacademy.e2e.utils.ConfigReader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Task 46 - Automate flow 2: Search / Browse courses.
 *
 * Requires frontend(:3000) and backend(:8080) to be running. If the frontend is
 * not reachable, tests are skipped through BaseTest.assumeAppIsRunning().
 */
class CourseBrowseTest extends BaseTest {

    private CourseBrowsePage courseBrowsePage;

    @BeforeEach
    void openCourseCatalog() {
        assumeAppIsRunning();
        courseBrowsePage = new CourseBrowsePage(driver, baseUrl).open();
    }

    @Test
    @DisplayName("Browse courses: catalog page shows searchable course state")
    void browseCourses_catalogShowsCourseState() {
        assertTrue(courseBrowsePage.isCatalogLoaded(),
                "Catalog page should show search, course cards, or empty state. URL: " + courseBrowsePage.currentUrl());
    }

    @Test
    @DisplayName("Search courses: keyword is submitted and results state is displayed")
    void searchCourses_keywordUpdatesCatalogState() {
        String keyword = ConfigReader.get("courseSearchKeyword", "math");

        courseBrowsePage.search(keyword);

        assertTrue(courseBrowsePage.isSearchApplied(keyword),
                "Search keyword should stay in the search box and catalog should display a result state. URL: "
                        + courseBrowsePage.currentUrl());
    }

    @Test
    @DisplayName("Browse courses: first visible course can be opened")
    void browseCourses_openFirstVisibleCourse() {
        if (courseBrowsePage.visibleCourseCount() == 0) {
            assertTrue(courseBrowsePage.hasEmptyState(),
                    "No visible course cards found, so catalog should show an empty state. URL: "
                            + courseBrowsePage.currentUrl());
            return;
        }

        courseBrowsePage.openFirstVisibleCourse();

        assertTrue(courseBrowsePage.isOnCourseDetailPage(),
                "Clicking a course card should navigate to a course detail page. URL: "
                        + courseBrowsePage.currentUrl());
    }
}
