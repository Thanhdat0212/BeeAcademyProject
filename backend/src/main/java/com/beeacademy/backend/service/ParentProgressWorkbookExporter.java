package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.ChildProgressReportResponse;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xddf.usermodel.chart.AxisCrosses;
import org.apache.poi.xddf.usermodel.chart.AxisPosition;
import org.apache.poi.xddf.usermodel.chart.BarDirection;
import org.apache.poi.xddf.usermodel.chart.ChartTypes;
import org.apache.poi.xddf.usermodel.chart.XDDFBarChartData;
import org.apache.poi.xddf.usermodel.chart.XDDFCategoryAxis;
import org.apache.poi.xddf.usermodel.chart.XDDFChartData;
import org.apache.poi.xddf.usermodel.chart.XDDFDataSource;
import org.apache.poi.xddf.usermodel.chart.XDDFDataSourcesFactory;
import org.apache.poi.xddf.usermodel.chart.XDDFNumericalDataSource;
import org.apache.poi.xddf.usermodel.chart.XDDFValueAxis;
import org.apache.poi.xssf.usermodel.XSSFChart;
import org.apache.poi.xssf.usermodel.XSSFClientAnchor;
import org.apache.poi.xssf.usermodel.XSSFDrawing;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.Date;
import java.util.List;

public final class ParentProgressWorkbookExporter {

    private static final int MAX_COLUMN_WIDTH = 48 * 256;

    private ParentProgressWorkbookExporter() {
    }

    public static byte[] export(ChildProgressReportResponse report) {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Styles styles = Styles.create(workbook);
            createWeeklySheet(workbook, report, styles);
            createCoursesSheet(workbook, report.courses(), styles);
            createRequiredExamsSheet(workbook, report.courses(), styles);
            createLessonsSheet(workbook, report.courses(), styles);
            createAssessmentsSheet(workbook, report.assessments(), styles);
            createCertificatesSheet(workbook, report.certificates(), styles);
            workbook.setActiveSheet(0);
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Không thể tạo báo cáo tiến độ XLSX.", exception);
        }
    }

    private static void createWeeklySheet(
            XSSFWorkbook workbook,
            ChildProgressReportResponse report,
            Styles styles) {
        XSSFSheet sheet = workbook.createSheet("Báo cáo tuần");
        sheet.createFreezePane(0, 7);
        sheet.setDisplayGridlines(false);

        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(30);
        Cell title = titleRow.createCell(0);
        title.setCellValue("Bee Academy - Báo cáo tiến độ học tập hàng tuần");
        title.setCellStyle(styles.title());
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 7));

        writeMeta(sheet, 2, "Học sinh", report.studentName(), styles);
        writeMeta(sheet, 3, "Khối lớp", report.gradeLabel(), styles);
        writeMeta(sheet, 4, "Tạo lúc", report.generatedAt(), styles);
        writeMeta(
                sheet,
                5,
                "Quyền xem chi tiết",
                report.detailAccessAllowed() ? "Được phép" : "Đang ẩn dữ liệu nhạy cảm",
                styles);

        String[] headers = {
                "Từ ngày",
                "Đến ngày",
                "Xu hướng",
                "Hoàn thành tuần này",
                "Hoàn thành tuần trước",
                "Điểm trung bình /10",
                "Bài chưa hoàn thành",
                "Ngày không học"
        };
        writeHeader(sheet, 7, styles, headers);

        ChildProgressReportResponse.WeeklySummary weekly = report.weeklySummary();
        Row summary = sheet.createRow(8);
        writeText(summary, 0, value(weekly.periodStart()), styles.text());
        writeText(summary, 1, value(weekly.periodEnd()), styles.text());
        writeText(summary, 2, weekly.progressTrend(), styles.text());
        writeNumber(summary, 3, weekly.currentWeekCompletedItems(), styles.integer());
        writeNumber(summary, 4, weekly.previousWeekCompletedItems(), styles.integer());
        writeNumber(summary, 5, weekly.averageScore(), styles.decimal());
        writeNumber(summary, 6, weekly.incompleteLearningItems(), styles.integer());
        writeNumber(summary, 7, weekly.inactiveDays(), styles.integer());

        Row ruleHeader = sheet.createRow(10);
        Cell ruleTitle = ruleHeader.createCell(0);
        ruleTitle.setCellValue("Nhận xét theo ngưỡng cấu hình");
        ruleTitle.setCellStyle(styles.section());
        sheet.addMergedRegion(new CellRangeAddress(10, 10, 0, 7));

        Row rule = sheet.createRow(11);
        writeText(rule, 0, "Quy tắc", styles.header());
        writeText(rule, 1, weekly.actionRule(), styles.text());
        writeText(rule, 2, "Khuyến nghị", styles.header());
        Cell suggestion = rule.createCell(3);
        suggestion.setCellValue(value(weekly.actionSuggestion()));
        suggestion.setCellStyle(styles.wrapped());
        sheet.addMergedRegion(new CellRangeAddress(11, 11, 3, 7));
        rule.setHeightInPoints(42);

        writeHeader(sheet, 14, styles, "Giai đoạn", "Mục hoàn thành");
        Row previous = sheet.createRow(15);
        writeText(previous, 0, "Tuần trước", styles.text());
        writeNumber(previous, 1, weekly.previousWeekCompletedItems(), styles.integer());
        Row current = sheet.createRow(16);
        writeText(current, 0, "Tuần này", styles.text());
        writeNumber(current, 1, weekly.currentWeekCompletedItems(), styles.integer());
        createWeeklyChart(sheet);

        autoSize(sheet, 8);
        sheet.setColumnWidth(3, Math.max(sheet.getColumnWidth(3), 20 * 256));
        sheet.setColumnWidth(4, Math.max(sheet.getColumnWidth(4), 20 * 256));
        sheet.setColumnWidth(7, Math.max(sheet.getColumnWidth(7), 18 * 256));
    }

    private static void createWeeklyChart(XSSFSheet sheet) {
        XSSFDrawing drawing = sheet.createDrawingPatriarch();
        XSSFClientAnchor anchor = drawing.createAnchor(0, 0, 0, 0, 3, 14, 8, 27);
        XSSFChart chart = drawing.createChart(anchor);
        chart.setTitleText("Xu hướng hoàn thành so với tuần trước");
        chart.setTitleOverlay(false);

        XDDFCategoryAxis categoryAxis = chart.createCategoryAxis(AxisPosition.BOTTOM);
        XDDFValueAxis valueAxis = chart.createValueAxis(AxisPosition.LEFT);
        valueAxis.setCrosses(AxisCrosses.AUTO_ZERO);
        valueAxis.setMinimum(0.0);

        XDDFDataSource<String> categories = XDDFDataSourcesFactory.fromStringCellRange(
                sheet,
                new CellRangeAddress(15, 16, 0, 0));
        XDDFNumericalDataSource<Double> values = XDDFDataSourcesFactory.fromNumericCellRange(
                sheet,
                new CellRangeAddress(15, 16, 1, 1));
        XDDFChartData data = chart.createData(ChartTypes.BAR, categoryAxis, valueAxis);
        XDDFBarChartData barData = (XDDFBarChartData) data;
        barData.setBarDirection(BarDirection.COL);
        XDDFChartData.Series series = data.addSeries(categories, values);
        series.setTitle("Mục hoàn thành", null);
        chart.plot(data);
    }

    private static void createCoursesSheet(
            XSSFWorkbook workbook,
            List<ChildProgressReportResponse.CourseProgressItem> courses,
            Styles styles) {
        Sheet sheet = workbook.createSheet("Tiến độ khóa học");
        sheet.createFreezePane(0, 1);
        writeHeader(
                sheet,
                0,
                styles,
                "Khóa học",
                "Phiên bản",
                "Giáo viên",
                "Trạng thái",
                "Tiến độ %",
                "Bài học hoàn thành",
                "Tổng bài học",
                "Quiz hoàn thành",
                "Tổng quiz",
                "Điểm quiz TB /10",
                "Exam mới nhất /10",
                "Assignment mới nhất /10",
                "Cập nhật tiến độ");

        int rowIndex = 1;
        for (ChildProgressReportResponse.CourseProgressItem course : courses) {
            Row row = sheet.createRow(rowIndex++);
            writeText(row, 0, course.courseTitle(), styles.text());
            writeText(row, 1, value(course.courseVersionId()), styles.text());
            writeText(row, 2, course.teacherName(), styles.text());
            writeText(row, 3, course.status(), styles.text());
            writeNumber(row, 4, course.progressPct(), styles.integer());
            writeNumber(row, 5, course.lessonCompletedCount(), styles.integer());
            writeNumber(row, 6, course.lessonTotalCount(), styles.integer());
            writeNumber(row, 7, course.quizCompletedCount(), styles.integer());
            writeNumber(row, 8, course.quizTotalCount(), styles.integer());
            writeNumber(row, 9, course.averageQuizScore(), styles.decimal());
            writeNumber(row, 10, course.latestExamScore(), styles.decimal());
            writeNumber(row, 11, course.latestAssignmentScore(), styles.decimal());
            writeInstant(row, 12, course.progressUpdatedAt(), styles.dateTime());
        }
        writeEmptyState(sheet, rowIndex, courses.isEmpty(), "Không có khóa học phù hợp.", 13, styles);
        finishTableSheet(sheet, 13, rowIndex);
    }

    private static void createRequiredExamsSheet(
            XSSFWorkbook workbook,
            List<ChildProgressReportResponse.CourseProgressItem> courses,
            Styles styles) {
        Sheet sheet = workbook.createSheet("4 bài kiểm tra");
        sheet.createFreezePane(0, 1);
        writeHeader(
                sheet,
                0,
                styles,
                "Khóa học",
                "Slot",
                "Nhãn chuẩn",
                "Tên cấu hình thực tế",
                "Loại bài kiểm tra",
                "Trạng thái",
                "Mã cấu hình",
                "Phiên bản khóa học",
                "Điểm %",
                "Điểm /10",
                "Kết quả",
                "Nộp lúc");

        int rowIndex = 1;
        for (ChildProgressReportResponse.CourseProgressItem course : courses) {
            for (ChildProgressReportResponse.RequiredExamResult exam : course.requiredExams()) {
                Row row = sheet.createRow(rowIndex++);
                writeText(row, 0, course.courseTitle(), styles.text());
                writeNumber(row, 1, exam.slotIndex() == null ? null : exam.slotIndex() + 1, styles.integer());
                writeText(row, 2, exam.label(), styles.text());
                writeText(row, 3, exam.examName(), styles.text());
                writeText(row, 4, exam.examType(), styles.text());
                writeText(row, 5, exam.status(), styles.text());
                writeText(row, 6, value(exam.examConfigId()), styles.text());
                writeText(row, 7, value(exam.courseVersionId()), styles.text());
                writeNumber(row, 8, exam.scorePercent(), styles.decimal());
                writeNumber(row, 9, exam.normalizedScore(), styles.decimal());
                writeText(row, 10, exam.passed() == null ? "" : exam.passed() ? "Đạt" : "Chưa đạt", styles.text());
                writeInstant(row, 11, exam.submittedAt(), styles.dateTime());
            }
        }
        writeEmptyState(sheet, rowIndex, rowIndex == 1, "Không có dữ liệu bài kiểm tra.", 12, styles);
        finishTableSheet(sheet, 12, rowIndex);
    }

    private static void createLessonsSheet(
            XSSFWorkbook workbook,
            List<ChildProgressReportResponse.CourseProgressItem> courses,
            Styles styles) {
        Sheet sheet = workbook.createSheet("Bài đã học");
        sheet.createFreezePane(0, 1);
        writeHeader(
                sheet,
                0,
                styles,
                "Khóa học",
                "Chương",
                "Vị trí chương",
                "Bài học",
                "Vị trí bài",
                "Thời lượng giây",
                "Hoàn thành lúc");

        int rowIndex = 1;
        for (ChildProgressReportResponse.CourseProgressItem course : courses) {
            for (ChildProgressReportResponse.LessonProgressItem lesson : course.completedLessons()) {
                Row row = sheet.createRow(rowIndex++);
                writeText(row, 0, course.courseTitle(), styles.text());
                writeText(row, 1, lesson.chapterTitle(), styles.text());
                writeNumber(row, 2, lesson.chapterPosition(), styles.integer());
                writeText(row, 3, lesson.lessonTitle(), styles.text());
                writeNumber(row, 4, lesson.lessonPosition(), styles.integer());
                writeNumber(row, 5, lesson.durationSec(), styles.integer());
                writeInstant(row, 6, lesson.completedAt(), styles.dateTime());
            }
        }
        writeEmptyState(sheet, rowIndex, rowIndex == 1, "Chưa có bài học đã hoàn thành.", 7, styles);
        finishTableSheet(sheet, 7, rowIndex);
    }

    private static void createAssessmentsSheet(
            XSSFWorkbook workbook,
            List<ChildProgressReportResponse.AssessmentRecord> assessments,
            Styles styles) {
        Sheet sheet = workbook.createSheet("Bảng điểm");
        sheet.createFreezePane(0, 1);
        writeHeader(
                sheet,
                0,
                styles,
                "Thời gian",
                "Khóa học",
                "Bài đánh giá",
                "Loại",
                "Chương",
                "Điểm gốc",
                "Điểm tối đa",
                "Điểm /10",
                "Nhận xét");

        int rowIndex = 1;
        for (ChildProgressReportResponse.AssessmentRecord assessment : assessments) {
            Row row = sheet.createRow(rowIndex++);
            writeInstant(row, 0, assessment.submittedAt(), styles.dateTime());
            writeText(row, 1, assessment.courseTitle(), styles.text());
            writeText(row, 2, assessment.assessmentName(), styles.text());
            writeText(row, 3, assessment.assessmentType(), styles.text());
            writeText(row, 4, assessment.chapterTitle(), styles.text());
            writeNumber(row, 5, assessment.rawScore(), styles.decimal());
            writeNumber(row, 6, assessment.maxScore(), styles.decimal());
            writeNumber(row, 7, assessment.normalizedScore(), styles.decimal());
            writeText(row, 8, assessment.feedback(), styles.wrapped());
        }
        writeEmptyState(sheet, rowIndex, assessments.isEmpty(), "Không có cột điểm phù hợp.", 9, styles);
        finishTableSheet(sheet, 9, rowIndex);
    }

    private static void createCertificatesSheet(
            XSSFWorkbook workbook,
            List<ChildProgressReportResponse.CertificateRecord> certificates,
            Styles styles) {
        Sheet sheet = workbook.createSheet("Chứng chỉ");
        sheet.createFreezePane(0, 1);
        writeHeader(
                sheet,
                0,
                styles,
                "Khóa học",
                "Giáo viên",
                "Trạng thái",
                "Số chứng chỉ",
                "Mã xác thực",
                "Phiên bản",
                "Ngày cấp",
                "Ngày thu hồi",
                "Ghi chú");

        int rowIndex = 1;
        for (ChildProgressReportResponse.CertificateRecord certificate : certificates) {
            Row row = sheet.createRow(rowIndex++);
            writeText(row, 0, certificate.courseTitle(), styles.text());
            writeText(row, 1, certificate.teacherName(), styles.text());
            writeText(row, 2, certificate.status(), styles.text());
            writeText(row, 3, certificate.certificateNo(), styles.text());
            writeText(row, 4, certificate.verificationCode(), styles.text());
            writeNumber(row, 5, certificate.versionNo(), styles.integer());
            writeInstant(row, 6, certificate.issuedAt(), styles.dateTime());
            writeInstant(row, 7, certificate.revokedAt(), styles.dateTime());
            writeText(row, 8, certificate.reviewNote(), styles.wrapped());
        }
        writeEmptyState(sheet, rowIndex, certificates.isEmpty(), "Chưa có chứng chỉ.", 9, styles);
        finishTableSheet(sheet, 9, rowIndex);
    }

    private static void writeMeta(
            Sheet sheet,
            int rowIndex,
            String label,
            Object value,
            Styles styles) {
        Row row = sheet.createRow(rowIndex);
        writeText(row, 0, label, styles.header());
        if (value instanceof Instant instant) {
            writeInstant(row, 1, instant, styles.dateTime());
        } else {
            writeText(row, 1, value(value), styles.text());
        }
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 1, 3));
    }

    private static void writeHeader(Sheet sheet, int rowIndex, Styles styles, String... headers) {
        Row row = sheet.createRow(rowIndex);
        row.setHeightInPoints(24);
        for (int index = 0; index < headers.length; index++) {
            writeText(row, index, headers[index], styles.header());
        }
    }

    private static void writeEmptyState(
            Sheet sheet,
            int rowIndex,
            boolean empty,
            String message,
            int columnCount,
            Styles styles) {
        if (!empty) {
            return;
        }
        Row row = sheet.createRow(rowIndex);
        writeText(row, 0, message, styles.text());
        if (columnCount > 1) {
            sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 0, columnCount - 1));
        }
    }

    private static void finishTableSheet(Sheet sheet, int columnCount, int lastDataRow) {
        autoSize(sheet, columnCount);
        if (lastDataRow > 1) {
            sheet.setAutoFilter(new CellRangeAddress(0, lastDataRow - 1, 0, columnCount - 1));
        }
    }

    private static void autoSize(Sheet sheet, int columnCount) {
        for (int column = 0; column < columnCount; column++) {
            sheet.autoSizeColumn(column);
            sheet.setColumnWidth(column, Math.min(sheet.getColumnWidth(column) + 512, MAX_COLUMN_WIDTH));
        }
    }

    private static void writeText(Row row, int columnIndex, String value, CellStyle style) {
        Cell cell = row.createCell(columnIndex);
        cell.setCellValue(value(value));
        cell.setCellStyle(style);
    }

    private static void writeNumber(Row row, int columnIndex, Number value, CellStyle style) {
        Cell cell = row.createCell(columnIndex);
        if (value != null) {
            cell.setCellValue(value.doubleValue());
        }
        cell.setCellStyle(style);
    }

    private static void writeInstant(Row row, int columnIndex, Instant value, CellStyle style) {
        Cell cell = row.createCell(columnIndex);
        if (value != null) {
            cell.setCellValue(Date.from(value));
        }
        cell.setCellStyle(style);
    }

    private static String value(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private record Styles(
            CellStyle title,
            CellStyle section,
            CellStyle header,
            CellStyle text,
            CellStyle wrapped,
            CellStyle integer,
            CellStyle decimal,
            CellStyle dateTime) {

        private static Styles create(XSSFWorkbook workbook) {
            Font titleFont = workbook.createFont();
            titleFont.setBold(true);
            titleFont.setFontHeightInPoints((short) 18);
            titleFont.setColor(IndexedColors.DARK_BLUE.getIndex());

            CellStyle title = workbook.createCellStyle();
            title.setFont(titleFont);
            title.setVerticalAlignment(VerticalAlignment.CENTER);

            Font sectionFont = workbook.createFont();
            sectionFont.setBold(true);
            sectionFont.setFontHeightInPoints((short) 12);
            CellStyle section = workbook.createCellStyle();
            section.setFont(sectionFont);
            section.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
            section.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            section.setVerticalAlignment(VerticalAlignment.CENTER);

            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            CellStyle header = workbook.createCellStyle();
            header.setFont(headerFont);
            header.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setAlignment(HorizontalAlignment.CENTER);
            header.setVerticalAlignment(VerticalAlignment.CENTER);
            header.setWrapText(true);
            applyBorders(header);

            CellStyle text = workbook.createCellStyle();
            text.setVerticalAlignment(VerticalAlignment.TOP);
            applyBorders(text);

            CellStyle wrapped = workbook.createCellStyle();
            wrapped.cloneStyleFrom(text);
            wrapped.setWrapText(true);

            CellStyle integer = workbook.createCellStyle();
            integer.cloneStyleFrom(text);
            integer.setDataFormat(workbook.createDataFormat().getFormat("0"));
            integer.setAlignment(HorizontalAlignment.RIGHT);

            CellStyle decimal = workbook.createCellStyle();
            decimal.cloneStyleFrom(text);
            decimal.setDataFormat(workbook.createDataFormat().getFormat("0.0"));
            decimal.setAlignment(HorizontalAlignment.RIGHT);

            CellStyle dateTime = workbook.createCellStyle();
            dateTime.cloneStyleFrom(text);
            dateTime.setDataFormat(workbook.createDataFormat().getFormat("dd/mm/yyyy hh:mm"));

            return new Styles(title, section, header, text, wrapped, integer, decimal, dateTime);
        }

        private static void applyBorders(CellStyle style) {
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
        }
    }
}
