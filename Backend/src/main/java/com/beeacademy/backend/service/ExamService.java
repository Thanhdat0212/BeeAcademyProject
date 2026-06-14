package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.ExamConfigRequest;
import com.beeacademy.backend.dto.request.ExamQuestionRandomRequest;
import com.beeacademy.backend.dto.response.ExamConfigResponse;
import com.beeacademy.backend.dto.response.QuestionStatsResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Course;
import com.beeacademy.backend.model.ExamConfig;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.Question;
import com.beeacademy.backend.model.QuestionChoice;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.CourseRepository;
import com.beeacademy.backend.repository.ExamConfigRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamConfigRepository examRepository;
    private final CourseRepository courseRepository;
    private final ChapterRepository chapterRepository;
    private final ProfileRepository profileRepository;
    private final QuestionRepository questionRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<ExamConfigResponse> listExams(UUID courseId, AuthenticatedUser me) {
        loadOwnedCourse(courseId, me.userId());
        return examRepository.findByCourseIdOrderBySlotIndexAsc(courseId).stream()
                .map(config -> ExamConfigResponse.fromEntity(config, objectMapper))
                .toList();
    }

    @Transactional(readOnly = true)
    public ExamConfigResponse getExam(UUID courseId, Integer slotIndex, AuthenticatedUser me) {
        loadOwnedCourse(courseId, me.userId());
        return examRepository.findByCourseIdAndSlotIndex(courseId, slotIndex)
                .map(config -> ExamConfigResponse.fromEntity(config, objectMapper))
                .orElseThrow(() -> new BusinessException("EXAM_NOT_FOUND",
                        "Chưa có bài kiểm tra cho vị trí này.", HttpStatus.NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public QuestionStatsResponse getQuestionBankStats(UUID courseId, AuthenticatedUser me) {
        Course course = loadOwnedCourse(courseId, me.userId());
        List<Object[]> rows = questionRepository.countActiveByDifficultyForTeacherCategoryAndGrades(
                me.userId(), courseCategoryId(course), courseGrades(course));

        int easy = 0, medium = 0, hard = 0;
        for (Object[] row : rows) {
            String diff = (String) row[0];
            long count = (Long) row[1];
            switch (diff) {
                case "easy" -> easy = (int) count;
                case "medium" -> medium = (int) count;
                case "hard" -> hard = (int) count;
                default -> {
                }
            }
        }
        return new QuestionStatsResponse(easy, medium, hard, easy + medium + hard);
    }

    @Transactional(readOnly = true)
    public List<ExamConfigResponse.ExamQuestionResponse> randomQuestions(
            UUID courseId, AuthenticatedUser me, ExamQuestionRandomRequest req) {
        Course course = loadOwnedCourse(courseId, me.userId());
        validateRandomRequest(req);

        if (hasChapterConfigs(req)) {
            List<ExamConfigResponse.ExamQuestionResponse> result = new ArrayList<>();
            for (ExamQuestionRandomRequest.ChapterQuestionRandomRequest chapterReq
                    : req.chapterConfigs()) {
                Chapter chapter = loadCourseChapter(courseId, chapterReq.chapterId());
                List<Question> selected = pickRandomQuestionsByChapter(
                        me.userId(), chapter.getId(), chapterReq.totalCount());
                result.addAll(selected.stream()
                        .map(question -> toExamQuestion(question, req.pointsPerQuestion()))
                        .toList());
            }
            Collections.shuffle(result);
            return result;
        }

        UUID categoryId = courseCategoryId(course);
        List<Integer> grades = courseGrades(course);
        List<Question> selected = new ArrayList<>();
        selected.addAll(pickRandomQuestions(me.userId(), categoryId, grades,
                "easy", req.easyCount()));
        selected.addAll(pickRandomQuestions(me.userId(), categoryId, grades,
                "medium", req.mediumCount()));
        selected.addAll(pickRandomQuestions(me.userId(), categoryId, grades,
                "hard", req.hardCount()));
        Collections.shuffle(selected);

        return selected.stream()
                .map(question -> toExamQuestion(question, req.pointsPerQuestion()))
                .toList();
    }

    @Transactional
    public ExamConfigResponse saveExam(UUID courseId, Integer slotIndex,
                                       AuthenticatedUser me, ExamConfigRequest req) {
        Course course = loadOwnedCourse(courseId, me.userId());
        Profile teacher = loadProfile(me.userId());
        validateSlot(courseId, slotIndex);
        validateRequest(req);

        String questionsJson = toJson(req.questions());
        ExamConfig config = examRepository.findByCourseIdAndSlotIndex(courseId, slotIndex)
                .orElse(null);

        if (config == null) {
            config = ExamConfig.create(course, teacher, slotIndex,
                    req.name().trim(), trimToNull(req.description()),
                    req.durationMinutes(), req.passScorePercent(), req.maxAttempts(),
                    req.shuffleQuestions(), req.shuffleOptions(), req.showAnswerAfterSubmit(),
                    questionsJson);
        } else {
            config.update(req.name().trim(), trimToNull(req.description()),
                    req.durationMinutes(), req.passScorePercent(), req.maxAttempts(),
                    req.shuffleQuestions(), req.shuffleOptions(), req.showAnswerAfterSubmit(),
                    questionsJson);
        }

        ExamConfig saved = examRepository.save(config);
        log.info("Teacher {} saved exam course={} slot={}", me.userId(), courseId, slotIndex);
        return ExamConfigResponse.fromEntity(saved, objectMapper);
    }

    @Transactional
    public void deleteExam(UUID courseId, Integer slotIndex, AuthenticatedUser me) {
        loadOwnedCourse(courseId, me.userId());
        ExamConfig config = examRepository.findByCourseIdAndSlotIndex(courseId, slotIndex)
                .orElseThrow(() -> new BusinessException("EXAM_NOT_FOUND",
                        "Chưa có bài kiểm tra cho vị trí này.", HttpStatus.NOT_FOUND));
        examRepository.delete(config);
    }

    private Course loadOwnedCourse(UUID courseId, UUID teacherId) {
        Course course = courseRepository.findWithCategoryAndTeacherById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course", courseId));
        if (course.getTeacher() == null || !course.getTeacher().getId().equals(teacherId)) {
            throw new BusinessException("FORBIDDEN",
                    "Bạn không có quyền quản lý bài kiểm tra của khóa học này.",
                    HttpStatus.FORBIDDEN);
        }
        return course;
    }

    private Profile loadProfile(UUID profileId) {
        return profileRepository.findById(profileId)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", profileId));
    }

    private void validateSlot(UUID courseId, Integer slotIndex) {
        if (slotIndex == null || slotIndex < 0) {
            throw new BusinessException("INVALID_SLOT", "Vị trí bài kiểm tra không hợp lệ.");
        }
        List<Chapter> chapters = chapterRepository.findByCourseIdOrderByPositionAsc(courseId);
        int slotCount = chapters.size() / 3;
        if (slotIndex >= slotCount) {
            throw new BusinessException("INVALID_SLOT",
                    "Khóa học cần đủ 3 chương cho mỗi bài kiểm tra.");
        }
    }

    private void validateRequest(ExamConfigRequest req) {
        if (req == null) {
            throw new BusinessException("INVALID_REQUEST", "Dữ liệu bài kiểm tra không hợp lệ.");
        }
        if (req.questions() == null || req.questions().isEmpty()) {
            throw new BusinessException("INVALID_QUESTIONS",
                    "Bài kiểm tra phải có ít nhất 1 câu hỏi.");
        }
        for (int i = 0; i < req.questions().size(); i++) {
            ExamConfigRequest.ExamQuestionRequest q = req.questions().get(i);
            if (q == null || q.options() == null || q.correctIndices() == null) {
                throw new BusinessException("INVALID_QUESTIONS",
                        "Câu " + (i + 1) + " không hợp lệ.");
            }
            if ("single".equals(q.type()) && q.correctIndices().size() != 1) {
                throw new BusinessException("INVALID_QUESTIONS",
                        "Câu " + (i + 1) + " dạng một đáp án phải có đúng 1 đáp án đúng.");
            }
            int optionCount = q.options().size();
            for (Integer correctIndex : q.correctIndices()) {
                if (correctIndex == null || correctIndex < 0 || correctIndex >= optionCount) {
                    throw new BusinessException("INVALID_QUESTIONS",
                            "Câu " + (i + 1) + " có đáp án đúng không hợp lệ.");
                }
            }
        }
    }

    private void validateRandomRequest(ExamQuestionRandomRequest req) {
        if (req != null && hasChapterConfigs(req)) {
            validateChapterRandomRequest(req);
            return;
        }
        if (req == null) {
            throw new BusinessException("INVALID_REQUEST", "Dữ liệu random câu hỏi không hợp lệ.");
        }
        if (req.easyCount() == null || req.mediumCount() == null
                || req.hardCount() == null || req.pointsPerQuestion() == null) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Phân bổ câu hỏi random không hợp lệ.");
        }
        int total = req.easyCount() + req.mediumCount() + req.hardCount();
        if (total <= 0) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Cần chọn ít nhất 1 câu hỏi để random.");
        }
        if (total > 200) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Mỗi lần random tối đa 200 câu hỏi.");
        }
    }

    private void validateChapterRandomRequest(ExamQuestionRandomRequest req) {
        if (req.pointsPerQuestion() == null) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Phân bổ câu hỏi random không hợp lệ.");
        }
        int total = 0;
        for (ExamQuestionRandomRequest.ChapterQuestionRandomRequest chapterReq
                : req.chapterConfigs()) {
            if (chapterReq.chapterId() == null
                    || chapterReq.totalCount() == null) {
                throw new BusinessException("INVALID_RANDOM_CONFIG",
                        "Phân bổ câu hỏi theo chương không hợp lệ.");
            }
            total += chapterReq.totalCount();
        }
        if (total <= 0) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Cần chọn ít nhất 1 câu hỏi để random.");
        }
        if (total > 200) {
            throw new BusinessException("INVALID_RANDOM_CONFIG",
                    "Mỗi lần random tối đa 200 câu hỏi.");
        }
    }

    private boolean hasChapterConfigs(ExamQuestionRandomRequest req) {
        return req.chapterConfigs() != null && !req.chapterConfigs().isEmpty();
    }

    private List<Question> pickRandomQuestions(UUID teacherId, UUID categoryId, List<Integer> grades,
                                               String difficulty, int count) {
        if (count <= 0) {
            return List.of();
        }
        List<Question> pool = new ArrayList<>(
                questionRepository.findActiveByTeacherAndCategoryAndGradesAndDifficulty(
                        teacherId, categoryId, grades, difficulty));
        if (pool.size() < count) {
            throw new BusinessException("QUESTION_BANK_NOT_ENOUGH",
                    "Ngân hàng câu hỏi chưa đủ câu " + difficulty
                            + ": cần " + count + ", hiện có " + pool.size() + ".");
        }
        Collections.shuffle(pool);
        return pool.subList(0, count);
    }

    private List<Question> pickRandomQuestionsByChapter(UUID teacherId, UUID chapterId,
                                                        int count) {
        if (count <= 0) {
            return List.of();
        }
        List<Question> pool = new ArrayList<>(
                questionRepository.findActiveByTeacherAndChapter(teacherId, chapterId));
        if (pool.size() < count) {
            throw new BusinessException("QUESTION_BANK_NOT_ENOUGH",
                    "Ngân hàng câu hỏi chưa đủ cho chương này: cần " + count
                            + ", hiện có " + pool.size() + ".");
        }
        Collections.shuffle(pool);
        return pool.subList(0, count);
    }

    private Chapter loadCourseChapter(UUID courseId, UUID chapterId) {
        Chapter chapter = chapterRepository.findById(chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));
        if (chapter.getCourse() == null || !chapter.getCourse().getId().equals(courseId)) {
            throw new BusinessException("INVALID_CHAPTER",
                    "Chương không thuộc khóa học đang chọn.");
        }
        return chapter;
    }

    private ExamConfigResponse.ExamQuestionResponse toExamQuestion(Question question,
                                                                   Double pointsPerQuestion) {
        List<QuestionChoice> choices = new ArrayList<>(question.getChoices());
        choices.sort(Comparator.comparing(QuestionChoice::getPosition));
        List<String> options = choices.stream()
                .map(QuestionChoice::getContent)
                .toList();
        List<Integer> correctIndices = IntStream.range(0, choices.size())
                .filter(i -> Boolean.TRUE.equals(choices.get(i).getIsCorrect()))
                .boxed()
                .toList();
        String examQuestionType = correctIndices.size() > 1 ? "multiple" : "single";
        return new ExamConfigResponse.ExamQuestionResponse(
                question.getId().toString(),
                question.getContent(),
                examQuestionType,
                options,
                correctIndices,
                question.getExplanation(),
                pointsPerQuestion,
                question.getDifficulty()
        );
    }

    private UUID courseCategoryId(Course course) {
        if (course.getCategory() == null) {
            throw new BusinessException("COURSE_CATEGORY_MISSING",
                    "Khóa học chưa có thông tin môn học.");
        }
        return course.getCategory().getId();
    }

    private List<Integer> courseGrades(Course course) {
        int[] grades = course.getGrades();
        if (grades == null || grades.length == 0) {
            throw new BusinessException("COURSE_GRADE_MISSING",
                    "Khóa học chưa có thông tin lớp.");
        }
        return Arrays.stream(grades).boxed().toList();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new BusinessException("INVALID_QUESTIONS",
                    "Không thể lưu danh sách câu hỏi.");
        }
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}

