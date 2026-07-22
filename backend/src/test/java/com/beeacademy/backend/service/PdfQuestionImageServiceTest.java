package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.response.ScannedQuestion;
import com.beeacademy.backend.dto.response.UploadResponse;
import com.lowagie.text.Document;
import com.lowagie.text.Image;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Ghép ảnh nhúng trong PDF vào câu hỏi Gemini trích ra là logic best-effort dựa trên THỨ TỰ
 * xuất hiện trong content stream (không dùng tọa độ hình học) — test này dựng 1 PDF giả có 2 câu
 * hỏi, mỗi câu kèm 1 ảnh khác nhau ngay sau, để xác nhận ảnh được gán đúng thứ tự câu hỏi.
 */
@ExtendWith(MockitoExtension.class)
class PdfQuestionImageServiceTest {

    @Mock
    ContentUploadService contentUploadService;

    @Test
    void attachImages_ganAnhDungThuTuCauHoiXuatHienTrongPdf() throws Exception {
        byte[] pdfBytes = buildTwoQuestionPdf(solidPng(Color.RED), solidPng(Color.BLUE));

        when(contentUploadService.uploadGeneratedQuestionImage(any(), any()))
                .thenReturn(new UploadResponse("p1", "https://cdn.test/anh-cau-1.png", "image/png", 100L))
                .thenReturn(new UploadResponse("p2", "https://cdn.test/anh-cau-2.png", "image/png", 100L));

        PdfQuestionImageService service = new PdfQuestionImageService(contentUploadService);

        List<ScannedQuestion> questions = List.of(
                scannedQuestion("Câu 1: Hình nào dưới đây là tam giác vuông?"),
                scannedQuestion("Câu 2: Hình nào dưới đây là hình vuông?"));

        List<ScannedQuestion> result = service.attachImages(pdfBytes, questions, UUID.randomUUID());

        assertThat(result.get(0).type()).isEqualTo("image_question");
        assertThat(result.get(0).promptAssetUrl()).isEqualTo("https://cdn.test/anh-cau-1.png");
        assertThat(result.get(1).type()).isEqualTo("image_question");
        assertThat(result.get(1).promptAssetUrl()).isEqualTo("https://cdn.test/anh-cau-2.png");
    }

    @Test
    void attachImages_khongDoiGiKhiPdfKhongCoAnh() throws Exception {
        byte[] pdfBytes = buildTextOnlyPdf();
        PdfQuestionImageService service = new PdfQuestionImageService(contentUploadService);

        List<ScannedQuestion> questions = List.of(scannedQuestion("Câu 1: 2 + 2 bằng mấy?"));
        List<ScannedQuestion> result = service.attachImages(pdfBytes, questions, UUID.randomUUID());

        assertThat(result.get(0).type()).isEqualTo("multiple_choice");
        assertThat(result.get(0).promptAssetUrl()).isNull();
    }

    private ScannedQuestion scannedQuestion(String content) {
        return new ScannedQuestion(
                content, "multiple_choice", "medium",
                List.of(new ScannedQuestion.ScannedChoice("A", true, null),
                        new ScannedQuestion.ScannedChoice("B", false, null)),
                null, null);
    }

    private byte[] solidPng(Color color) throws Exception {
        BufferedImage img = new BufferedImage(80, 80, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(color);
        g.fillRect(0, 0, 80, 80);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    private byte[] buildTwoQuestionPdf(byte[] image1, byte[] image2) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document();
        PdfWriter.getInstance(document, out);
        document.open();
        document.add(new Paragraph("Câu 1: Hình nào dưới đây là tam giác vuông?"));
        document.add(Image.getInstance(image1));
        document.add(new Paragraph("Câu 2: Hình nào dưới đây là hình vuông?"));
        document.add(Image.getInstance(image2));
        document.close();
        return out.toByteArray();
    }

    private byte[] buildTextOnlyPdf() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document();
        PdfWriter.getInstance(document, out);
        document.open();
        document.add(new Paragraph("Câu 1: 2 + 2 bằng mấy?"));
        document.close();
        return out.toByteArray();
    }
}
