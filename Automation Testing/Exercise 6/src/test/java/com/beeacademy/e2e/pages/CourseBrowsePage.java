package com.beeacademy.e2e.pages;

import com.beeacademy.e2e.base.BasePage;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;

import java.text.Normalizer;
import java.util.List;

/**
 * Page Object for the public course catalog/search page.
 *
 * Preferred locators are data-testid/name/type. CSS/XPath fallbacks keep the
 * test runnable while the frontend has not standardized test ids yet.
 */
public class CourseBrowsePage extends BasePage {

    private static final By PAGE_ROOT = By.cssSelector("main, [role='main'], body");
    private static final By SEARCH_INPUT = By.cssSelector(
            "[data-testid='course-search'], " +
            "[data-testid='search-input'], " +
            "input[name='q'], " +
            "input[name='search'], " +
            "input[type='search'], " +
            "input[placeholder*='Tìm'], " +
            "input[placeholder*='tìm'], " +
            "form input[type='text']");
    // Catalog page co o tim kiem rieng (placeholder "Tim khoa hoc..."), tach biet voi
    // o tim kiem tren header ("Tim kiem khoa hoc, mon hoc..."). O nay loc ket qua truc tiep
    // tren trang nen dung de assert search state. No la md:hidden -> chi hien khi viewport < 768px.
    private static final By CATALOG_SEARCH_INPUT = By.cssSelector("input[placeholder*='Tìm khóa']");
    private static final By COURSE_CARD = By.cssSelector(
            "[data-testid='course-card'], " +
            "[data-testid='course-item'], " +
            "[data-testid='course-list-item'], " +
            ".course-card, " +
            "a[href*='/courses/']");
    // Cac cum tu bao trang dang rong, da chuan hoa ve khong dau de so khop bat ke diacritics.
    private static final List<String> EMPTY_STATE_MARKERS = List.of(
            "no courses", "not found", "empty",
            "khong tim thay", "khong co khoa hoc", "khong co khoa hoc phu hop");

    private final String baseUrl;

    public CourseBrowsePage(WebDriver driver, String baseUrl) {
        super(driver);
        this.baseUrl = baseUrl;
    }

    public CourseBrowsePage open() {
        driver.get(baseUrl + "/courses");
        wait.until(ExpectedConditions.urlContains("/courses"));
        waitVisible(PAGE_ROOT);
        waitForCatalogState();
        return this;
    }

    public void search(String keyword) {
        WebElement input = revealCatalogSearchInput();
        input.clear();
        input.sendKeys(keyword);

        wait.until(d -> keyword.equals(catalogSearchValue()));
        waitForCatalogState();
    }

    public boolean isCatalogLoaded() {
        return driver.getCurrentUrl().contains("/courses")
                && !pageLooksLikeNotFound()
                && (hasSearchInput() || hasCourseCards() || hasEmptyState() || pageContainsCourseText());
    }

    public boolean hasSearchInput() {
        return !driver.findElements(SEARCH_INPUT).isEmpty();
    }

    public boolean hasCourseCards() {
        return visibleCourseCards().size() > 0;
    }

    public boolean hasEmptyState() {
        String body = normalizedBodyText();
        return EMPTY_STATE_MARKERS.stream().anyMatch(body::contains);
    }

    public int visibleCourseCount() {
        return visibleCourseCards().size();
    }

    public boolean isSearchApplied(String keyword) {
        return keyword.equals(catalogSearchValue())
                && (hasCourseCards() || hasEmptyState() || pageContains(keyword));
    }

    public void openFirstVisibleCourse() {
        WebElement firstCourse = visibleCourseCards().get(0);
        WebElement clickTarget = findCourseClickTarget(firstCourse);
        String beforeUrl = driver.getCurrentUrl();
        clickTarget.click();
        wait.until(ExpectedConditions.not(ExpectedConditions.urlToBe(beforeUrl)));
        waitVisible(PAGE_ROOT);
    }

    public boolean isOnCourseDetailPage() {
        String currentUrl = driver.getCurrentUrl();
        return currentUrl.contains("/courses/") && !currentUrl.endsWith("/courses");
    }

    public String currentUrl() {
        return driver.getCurrentUrl();
    }

    /**
     * O tim kiem cua catalog la md:hidden (chi hien < 768px). Neu dang o viewport desktop
     * va o nay chua hien, thu nho cua so xuong mobile de lo o tim kiem ra roi moi thao tac.
     */
    private WebElement revealCatalogSearchInput() {
        boolean visible = driver.findElements(CATALOG_SEARCH_INPUT).stream().anyMatch(WebElement::isDisplayed);
        if (!visible) {
            driver.manage().window().setSize(new Dimension(420, 900));
        }
        return wait.until(ExpectedConditions.visibilityOfElementLocated(CATALOG_SEARCH_INPUT));
    }

    private String catalogSearchValue() {
        String value = driver.findElement(CATALOG_SEARCH_INPUT).getDomProperty("value");
        return value == null ? "" : value;
    }

    private List<WebElement> visibleCourseCards() {
        return driver.findElements(COURSE_CARD).stream()
                .filter(WebElement::isDisplayed)
                .toList();
    }

    private WebElement findCourseClickTarget(WebElement courseCard) {
        String tagName = courseCard.getTagName();
        if ("a".equalsIgnoreCase(tagName) || "button".equalsIgnoreCase(tagName)) {
            return courseCard;
        }

        List<WebElement> nestedLinks = courseCard.findElements(By.cssSelector("a[href*='/courses/'], button"));
        return nestedLinks.stream()
                .filter(WebElement::isDisplayed)
                .findFirst()
                .orElse(courseCard);
    }

    // Cho catalog tai xong han: o tim kiem tren header luon co san nen khong dung de
    // xac dinh "da tai". Phai cho den khi het skeleton loading va co course card HOAC empty state.
    private void waitForCatalogState() {
        wait.until(d -> !isLoadingCatalog() && (hasCourseCards() || hasEmptyState()));
    }

    private boolean isLoadingCatalog() {
        return normalizedBodyText().contains("dang tai");
    }

    private boolean pageContainsCourseText() {
        String body = normalizedBodyText();
        return body.contains("course") || body.contains("khoa hoc") || body.contains("mon hoc");
    }

    private boolean pageContains(String expectedText) {
        return normalizedBodyText().contains(stripDiacritics(expectedText.toLowerCase()));
    }

    private boolean pageLooksLikeNotFound() {
        String body = normalizedBodyText();
        return body.contains("404") || body.contains("page not found");
    }

    private String normalizedBodyText() {
        return stripDiacritics(driver.findElement(By.tagName("body")).getText().toLowerCase());
    }

    // Bo dau tieng Viet (khoa hoc <- khóa học) de locator khong vo khi UI dung diacritics.
    private static String stripDiacritics(String input) {
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return normalized.replace('đ', 'd').replace('Đ', 'D');
    }
}
