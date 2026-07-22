package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.StudentLearningProgressResponse;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.text.Normalizer;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LearningProgressPdfService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter
            .ofPattern("dd/MM/yyyy HH:mm")
            .withZone(ZoneId.systemDefault());
    private static final List<String> FONT_CANDIDATES = List.of(
            "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf");

    private final CourseProgressService courseProgressService;
    private final ProfileRepository profileRepository;

    @Transactional(readOnly = true)
    public byte[] generate(AuthenticatedUser me) {
        StudentLearningProgressResponse progress = courseProgressService.getLearningProgress(me);
        Profile student = profileRepository.findById(me.userId()).orElse(null);
        String studentName = student != null && student.getFullName() != null
                && !student.getFullName().isBlank()
                ? student.getFullName()
                : me.email();

        try {
            PdfFontSet fonts = loadFonts();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            Document document = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(document, output);
            document.addTitle(pdfText("Báo cáo tiến độ học tập", fonts));
            document.addAuthor("Bee Academy");
            document.open();

            Paragraph title = paragraph("BÁO CÁO TIẾN ĐỘ HỌC TẬP", fonts, 18, Font.BOLD, new Color(173, 44, 0));
            title.setAlignment(Element.ALIGN_CENTER);
            title.setSpacingAfter(12);
            document.add(title);
            document.add(paragraph("Học sinh: " + studentName, fonts, 10, Font.NORMAL, Color.DARK_GRAY));
            document.add(paragraph("Ngày xuất: " + DATE_FORMAT.format(Instant.now()), fonts, 10, Font.NORMAL, Color.DARK_GRAY));
            Paragraph summary = paragraph(
                    "Tổng quan: " + progress.totalCourses() + " khóa học | Tiến độ trung bình: "
                            + progress.averageProgressPct() + "% | Bài học: "
                            + progress.completedLessons() + "/" + progress.totalLessons()
                            + " | Điểm TB: " + formatPercent(progress.averageScorePercent())
                            + " | Thời gian học: " + formatDuration(progress.totalStudyTimeSec()),
                    fonts, 10, Font.BOLD, Color.BLACK);
            summary.setSpacingAfter(14);
            document.add(summary);

            if (progress.courses().isEmpty()) {
                document.add(paragraph(
                        "Bắt đầu học để xem tiến độ.", fonts, 11, Font.ITALIC, Color.DARK_GRAY));
            }

            for (StudentLearningProgressResponse.CourseProgressDetail course : progress.courses()) {
                addCourse(document, course, fonts);
            }

            document.close();
            return output.toByteArray();
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể tạo báo cáo tiến độ PDF.", exception);
        }
    }

    private void addCourse(
            Document document,
            StudentLearningProgressResponse.CourseProgressDetail course,
            PdfFontSet fonts
    ) throws Exception {
        Paragraph heading = paragraph(course.title(), fonts, 13, Font.BOLD, new Color(93, 30, 10));
        heading.setSpacingBefore(10);
        heading.setSpacingAfter(4);
        document.add(heading);

        String version = course.courseVersionId() != null ? course.courseVersionId().toString() : "Chưa ghi nhận";
        document.add(paragraph(
                "Phiên bản khóa học: " + version + " | Tiến độ: " + course.progressPct() + "% | Bài học: "
                        + course.completedLessons() + "/" + course.totalLessons() + " | Quiz: "
                        + course.completedQuizzes() + "/" + course.totalQuizzes()
                        + " | Điểm TB: " + formatPercent(course.averageScorePercent())
                        + " | Thời gian học: " + formatDuration(course.studyTimeSec()),
                fonts, 9, Font.NORMAL, Color.DARK_GRAY));
        document.add(paragraph(
                "Bài thi bắt buộc đã đạt: " + course.passedRequiredExams() + "/4",
                fonts, 9, Font.BOLD, Color.BLACK));

        PdfPTable examTable = new PdfPTable(new float[]{2.4f, 1.4f, 1.0f, 1.6f});
        examTable.setWidthPercentage(100);
        examTable.setSpacingBefore(5);
        examTable.setSpacingAfter(8);
        addHeader(examTable, "Bài thi", fonts);
        addHeader(examTable, "Trạng thái", fonts);
        addHeader(examTable, "Điểm", fonts);
        addHeader(examTable, "Ngày nộp", fonts);
        for (StudentLearningProgressResponse.RequiredExamProgress exam : course.requiredExams()) {
            addCell(examTable, exam.label(), fonts);
            addCell(examTable, statusLabel(exam.status()), fonts);
            addCell(examTable, exam.scorePercent() == null ? "-" : formatScore(exam.scorePercent()) + "/100", fonts);
            addCell(examTable, exam.submittedAt() == null ? "-" : DATE_FORMAT.format(exam.submittedAt()), fonts);
        }
        document.add(examTable);

        if (course.assignments() != null && !course.assignments().isEmpty()) {
            PdfPTable assignmentTable = new PdfPTable(new float[]{2.8f, 1.5f, 1.2f, 1.6f});
            assignmentTable.setWidthPercentage(100);
            assignmentTable.setSpacingAfter(8);
            addHeader(assignmentTable, "Bài tập", fonts);
            addHeader(assignmentTable, "Chương", fonts);
            addHeader(assignmentTable, "Điểm", fonts);
            addHeader(assignmentTable, "Trạng thái", fonts);
            for (StudentLearningProgressResponse.AssignmentProgress assignment : course.assignments()) {
                addCell(assignmentTable, assignment.title(), fonts);
                addCell(assignmentTable, assignment.chapterTitle() != null ? assignment.chapterTitle() : "-", fonts);
                addCell(assignmentTable, assignment.score() == null
                        ? "-"
                        : formatScore(assignment.score()) + "/" + formatScore(assignment.maxScore()), fonts);
                addCell(assignmentTable, "graded".equals(assignment.status()) ? "Đã chấm" : "Chờ chấm", fonts);
            }
            document.add(assignmentTable);
        }

        if (!course.chapters().isEmpty()) {
            PdfPTable chapterTable = new PdfPTable(new float[]{3.2f, 1.2f, 1.2f});
            chapterTable.setWidthPercentage(100);
            chapterTable.setSpacingAfter(8);
            addHeader(chapterTable, "Chương", fonts);
            addHeader(chapterTable, "Bài học", fonts);
            addHeader(chapterTable, "Hoàn thành", fonts);
            for (StudentLearningProgressResponse.ChapterProgressDetail chapter : course.chapters()) {
                int chapterPct = chapter.totalLessons() == 0
                        ? 0
                        : (int) Math.round(chapter.completedLessons() * 100.0 / chapter.totalLessons());
                addCell(chapterTable, chapter.position() + ". " + chapter.title(), fonts);
                addCell(chapterTable, chapter.completedLessons() + "/" + chapter.totalLessons(), fonts);
                addCell(chapterTable, chapterPct + "%", fonts);
            }
            document.add(chapterTable);
        }
    }

    private void addHeader(PdfPTable table, String value, PdfFontSet fonts) {
        PdfPCell cell = new PdfPCell(new Phrase(pdfText(value, fonts), font(fonts, 9, Font.BOLD, Color.WHITE)));
        cell.setBackgroundColor(new Color(173, 44, 0));
        cell.setPadding(6);
        cell.setBorder(Rectangle.NO_BORDER);
        table.addCell(cell);
    }

    private void addCell(PdfPTable table, String value, PdfFontSet fonts) {
        PdfPCell cell = new PdfPCell(new Phrase(pdfText(value, fonts), font(fonts, 8, Font.NORMAL, Color.BLACK)));
        cell.setPadding(6);
        cell.setBorderColor(new Color(220, 220, 220));
        table.addCell(cell);
    }

    private Paragraph paragraph(String value, PdfFontSet fonts, float size, int style, Color color) {
        return new Paragraph(pdfText(value, fonts), font(fonts, size, style, color));
    }

    private Font font(PdfFontSet fonts, float size, int style, Color color) {
        return new Font(fonts.baseFont(), size, style, color);
    }

    private PdfFontSet loadFonts() throws Exception {
        for (String candidate : FONT_CANDIDATES) {
            if (new File(candidate).isFile()) {
                return new PdfFontSet(
                        BaseFont.createFont(candidate, BaseFont.IDENTITY_H, BaseFont.EMBEDDED),
                        true);
            }
        }
        return new PdfFontSet(
                BaseFont.createFont(BaseFont.HELVETICA, BaseFont.WINANSI, BaseFont.NOT_EMBEDDED),
                false);
    }

    private String pdfText(String value, PdfFontSet fonts) {
        if (value == null) return "";
        if (fonts.unicode()) return value;
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('Đ', 'D')
                .replace('đ', 'd');
    }

    private String statusLabel(String status) {
        if (status == null) return "Chưa làm";
        return switch (status) {
            case "passed" -> "Đạt";
            case "failed" -> "Chưa đạt";
            case "pending_grading" -> "Chờ chấm";
            case "in_progress" -> "Đang làm";
            case "not_configured" -> "Chưa cấu hình";
            default -> "Chưa nộp";
        };
    }

    private String formatScore(Double score) {
        if (score == null) return "-";
        return score % 1 == 0 ? String.valueOf(score.intValue()) : String.format(java.util.Locale.US, "%.1f", score);
    }

    private String formatPercent(Double score) {
        return score == null ? "Chưa có" : formatScore(score) + "%";
    }

    private String formatDuration(Long seconds) {
        long safe = seconds == null ? 0L : Math.max(0L, seconds);
        long hours = safe / 3600;
        long minutes = (safe % 3600) / 60;
        return hours > 0 ? hours + " giờ " + minutes + " phút" : minutes + " phút";
    }

    private record PdfFontSet(BaseFont baseFont, boolean unicode) {}
}
