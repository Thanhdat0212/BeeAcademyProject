package com.beeacademy.backend.service;

import com.beeacademy.backend.dto.request.CreateQuestionRequest;
import com.beeacademy.backend.dto.response.PageResponse;
import com.beeacademy.backend.dto.response.QuestionResponse;
import com.beeacademy.backend.dto.response.QuestionStatsResponse;
import com.beeacademy.backend.exception.BusinessException;
import com.beeacademy.backend.exception.ResourceNotFoundException;
import com.beeacademy.backend.model.Category;
import com.beeacademy.backend.model.Chapter;
import com.beeacademy.backend.model.Profile;
import com.beeacademy.backend.model.Question;
import com.beeacademy.backend.model.QuestionChoice;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final CategoryRepository categoryRepository;
    private final ProfileRepository  profileRepository;
    private final ChapterRepository  chapterRepository;

    @Lazy
    @Autowired
    private QuestionService self;

    @Transactional
    public QuestionResponse createQuestion(AuthenticatedUser me, CreateQuestionRequest req) {
        validateQuestionRequest(req);

        Profile teacher  = loadProfile(me.userId());
        Category category = loadCategory(req.categoryId());

        Chapter chapter = null;
        if (req.chapterId() != null) {
            chapter = loadChapter(req.chapterId());
        }

        validateCategoryMatchesChapter(req.categoryId(), chapter);
        validateGradeMatchesChapter(req.categoryId(), req.grade(), chapter);

        long correctCount = req.choices().stream()
                .filter(CreateQuestionRequest.ChoiceRequest::isCorrect).count();
        if (correctCount != 1) {
            throw new BusinessException("INVALID_CHOICES",
                    "Câu hỏi phải có đúng 1 đáp án đúng (hiện có: " + correctCount + ").");
        }

        Question question = Question.create(teacher, category, req.grade(), chapter,
                req.content(), req.explanation(), req.difficulty(), req.type());

        List<CreateQuestionRequest.ChoiceRequest> choiceReqs = req.choices();
        for (int i = 0; i < choiceReqs.size(); i++) {
            CreateQuestionRequest.ChoiceRequest cr = choiceReqs.get(i);
            QuestionChoice choice = QuestionChoice.create(question, cr.content(), cr.isCorrect(), i + 1);
            question.addChoice(choice);
        }

        Question saved = questionRepository.save(question);
        log.info("GV {} tạo câu hỏi {}", me.userId(), saved.getId());
        return QuestionResponse.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<QuestionResponse> listQuestions(AuthenticatedUser me,
                                                        UUID categoryId, Integer grade,
                                                        UUID chapterId, String difficulty,
                                                        String status, Pageable pageable) {
        String resolvedStatus = status != null ? status : "active";
        Specification<Question> spec = (root, query, cb) ->
                cb.equal(root.get("teacher").get("id"), me.userId());

        spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), resolvedStatus));

        if (categoryId != null)
            spec = spec.and((root, query, cb) -> cb.equal(root.get("category").get("id"), categoryId));
        if (grade != null)
            spec = spec.and((root, query, cb) -> cb.equal(root.get("grade"), grade));
        if (chapterId != null)
            spec = spec.and((root, query, cb) -> cb.equal(root.get("chapter").get("id"), chapterId));
        if (difficulty != null && !difficulty.isBlank())
            spec = spec.and((root, query, cb) -> cb.equal(root.get("difficulty"), difficulty));

        Page<Question> page = questionRepository.findAll(spec, pageable);
        return PageResponse.of(page, QuestionResponse::fromEntity);
    }

    @Transactional(readOnly = true)
    public QuestionResponse getQuestion(UUID questionId, AuthenticatedUser me) {
        Question q = loadAndVerifyOwner(questionId, me.userId());
        return QuestionResponse.fromEntity(q);
    }

    @Transactional
    public QuestionResponse updateQuestion(UUID questionId, AuthenticatedUser me,
                                           CreateQuestionRequest req) {
        validateQuestionRequest(req);
        Question question = loadAndVerifyOwner(questionId, me.userId());

        long correctCount = req.choices().stream()
                .filter(CreateQuestionRequest.ChoiceRequest::isCorrect).count();
        if (correctCount != 1) {
            throw new BusinessException("INVALID_CHOICES", "Câu hỏi phải có đúng 1 đáp án đúng.");
        }

        Category category = loadCategory(req.categoryId());
        Chapter chapter = req.chapterId() != null ? loadChapter(req.chapterId()) : null;
        validateCategoryMatchesChapter(req.categoryId(), chapter);
        validateGradeMatchesChapter(req.categoryId(), req.grade(), chapter);

        question.update(category, req.grade(), chapter,
                req.content(), req.explanation(), req.difficulty());
        question.clearChoices();

        List<CreateQuestionRequest.ChoiceRequest> choiceReqs = req.choices();
        for (int i = 0; i < choiceReqs.size(); i++) {
            CreateQuestionRequest.ChoiceRequest cr = choiceReqs.get(i);
            QuestionChoice choice = QuestionChoice.create(question, cr.content(), cr.isCorrect(), i + 1);
            question.addChoice(choice);
        }

        return QuestionResponse.fromEntity(questionRepository.save(question));
    }

    @Transactional
    public void deleteQuestion(UUID questionId, AuthenticatedUser me) {
        Question question = loadAndVerifyOwner(questionId, me.userId());

        if (question.getUsageCount() > 0) {
            question.deactivate();
            questionRepository.save(question);
            log.info("Deactivate câu hỏi {} (đã dùng {} lần)", questionId, question.getUsageCount());
        } else {
            questionRepository.delete(question);
            log.info("Xóa câu hỏi {}", questionId);
        }
    }

    public BulkImportResult bulkCreateQuestions(AuthenticatedUser me,
                                                List<CreateQuestionRequest> requests) {
        int created = 0, failed = 0;
        List<BulkImportError> errors = new ArrayList<>();

        if (requests == null || requests.isEmpty()) {
            return new BulkImportResult(0, 0, errors);
        }
        if (requests.size() > 200) {
            throw new BusinessException("BULK_LIMIT_EXCEEDED",
                    "Mỗi lần chỉ được nhập tối đa 200 câu hỏi.");
        }

        for (int i = 0; i < requests.size(); i++) {
            try {
                self.createQuestion(me, requests.get(i));
                created++;
            } catch (Exception e) {
                failed++;
                errors.add(new BulkImportError(i + 1, e.getMessage()));
            }
        }
        return new BulkImportResult(created, failed, errors);
    }

    public record BulkImportResult(int created, int failed, List<BulkImportError> errors) {}
    public record BulkImportError(int row, String message) {}

    @Transactional(readOnly = true)
    public QuestionStatsResponse getStatsForChapter(AuthenticatedUser me, UUID chapterId) {
        loadChapter(chapterId);
        List<Object[]> rows =
                questionRepository.countActiveByDifficultyForTeacherAndChapter(me.userId(), chapterId);
        int easy = 0, medium = 0, hard = 0;
        for (Object[] row : rows) {
            String diff = (String) row[0];
            long count  = (Long) row[1];
            switch (diff) {
                case "easy"   -> easy   = (int) count;
                case "medium" -> medium = (int) count;
                case "hard"   -> hard   = (int) count;
            }
        }
        return new QuestionStatsResponse(easy, medium, hard, easy + medium + hard);
    }

    private Question loadAndVerifyOwner(UUID questionId, UUID teacherId) {
        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", questionId));
        if (!q.getTeacher().getId().equals(teacherId)) {
            throw new BusinessException("FORBIDDEN",
                    "Bạn không có quyền chỉnh sửa câu hỏi này.", HttpStatus.FORBIDDEN);
        }
        return q;
    }

    private Profile loadProfile(UUID id) {
        return profileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", id));
    }

    private void validateQuestionRequest(CreateQuestionRequest req) {
        if (req == null) throw new BusinessException("INVALID_REQUEST", "Dữ liệu câu hỏi không hợp lệ.");
        if (req.categoryId() == null) throw new BusinessException("CATEGORY_REQUIRED", "Vui lòng chọn môn học.");
        if (req.grade() == null || req.grade() < 1) throw new BusinessException("GRADE_REQUIRED", "Vui lòng chọn lớp.");
        if (req.content() == null || req.content().isBlank())
            throw new BusinessException("CONTENT_REQUIRED", "Nội dung câu hỏi không được trống.");
        if (!List.of("easy", "medium", "hard").contains(req.difficulty()))
            throw new BusinessException("INVALID_DIFFICULTY", "Độ khó phải là easy, medium hoặc hard.");
        if (!List.of("multiple_choice", "true_false").contains(req.type()))
            throw new BusinessException("INVALID_TYPE", "Loại câu hỏi không hợp lệ.");
        if (req.choices() == null || req.choices().size() < 2 || req.choices().size() > 4)
            throw new BusinessException("INVALID_CHOICES", "Câu hỏi phải có 2-4 đáp án.");
        for (CreateQuestionRequest.ChoiceRequest choice : req.choices()) {
            if (choice == null || choice.content() == null || choice.content().isBlank())
                throw new BusinessException("INVALID_CHOICES", "Đáp án không được trống.");
        }
        long correctCount = req.choices().stream()
                .filter(CreateQuestionRequest.ChoiceRequest::isCorrect).count();
        if (correctCount != 1)
            throw new BusinessException("INVALID_CHOICES",
                    "Câu hỏi phải có đúng 1 đáp án đúng (hiện có: " + correctCount + ").");
    }

    private Category loadCategory(UUID id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }

    private Chapter loadChapter(UUID chapterId) {
        return chapterRepository.findWithCourseById(chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));
    }

    private void validateCategoryMatchesChapter(UUID requestedCategoryId, Chapter chapter) {
        if (chapter == null) return;
        Category courseCategory = chapter.getCourse().getCategory();
        if (courseCategory == null) return;
        if (!courseCategory.getId().equals(requestedCategoryId)) {
            throw new BusinessException("CATEGORY_MISMATCH",
                    "Môn học không khớp với khóa học của chương đã chọn. " +
                    "Chương này thuộc môn: " + courseCategory.getName() + ".");
        }
    }

    private void validateGradeMatchesChapter(UUID requestedCategoryId, Integer grade, Chapter chapter) {
        if (chapter == null || grade == null) return;
        validateCategoryMatchesChapter(requestedCategoryId, chapter);
        if (!courseGrades(chapter).contains(grade)) {
            throw new BusinessException("GRADE_MISMATCH", "Lớp không khớp với khóa học của chương đã chọn.");
        }
    }

    private List<Integer> courseGrades(Chapter chapter) {
        int[] grades = chapter.getCourse().getGrades();
        if (grades == null || grades.length == 0)
            throw new BusinessException("COURSE_GRADE_MISSING", "Khóa học của chương chưa có thông tin lớp.");
        return Arrays.stream(grades).boxed().toList();
    }
}
