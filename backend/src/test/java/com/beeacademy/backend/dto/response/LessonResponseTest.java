package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.CourseDocument;
import com.beeacademy.backend.model.Lesson;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LessonResponseTest {

    @Test
    void lockedPaidLessonHidesVideoAndDocumentsForGuest() {
        Lesson lesson = Lesson.createNew(null, "Bai tra phi", null, 1, false);
        lesson.setVideoEmbedUrl("https://video.example.com/embed/paid");
        CourseDocument document = CourseDocument.create(
                lesson,
                "Tai lieu tra phi",
                "https://cdn.example.com/paid.pdf",
                "pdf",
                1024L,
                1
        );

        LessonResponse response = LessonResponse.fromEntity(
                lesson,
                false,
                null,
                List.of(document)
        );

        assertThat(response.videoUrl()).isNull();
        assertThat(response.videoEmbedUrl()).isNull();
        assertThat(response.documents()).isEmpty();
    }

    @Test
    void freeLessonDoesNotExposeDocumentStorageUrlForGuestPreview() {
        Lesson lesson = Lesson.createNew(null, "Bài học thu", null, 1, true);
        lesson.setVideoEmbedUrl("https://video.example.com/embed/free");
        CourseDocument document = CourseDocument.create(
                lesson,
                "Tai lieu hoc thu",
                "https://cdn.example.com/free.pdf",
                "pdf",
                2048L,
                1
        );

        LessonResponse response = LessonResponse.fromEntity(
                lesson,
                false,
                null,
                List.of(document)
        );

        assertThat(response.videoEmbedUrl()).isEqualTo("https://video.example.com/embed/free");
        assertThat(response.documents())
                .singleElement()
                .satisfies(dto -> {
                    assertThat(dto.name()).isEqualTo("Tai lieu hoc thu");
                    assertThat(dto.fileUrl()).isNull();
                });
    }
}
