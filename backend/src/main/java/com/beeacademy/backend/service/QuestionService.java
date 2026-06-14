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

/**
 * Nghiệp vụ quản lý Ngân hàng câu hỏi (Phase 4 — UC29).
 *
 * <p>Quy tắc:
 * <ul>
 *   <li>GV chỉ xem/sửa/xóa câu hỏi của chính mình.</li>
 *   <li>Bắt buộc đúng 1 choice có {@code isCorrect=true}.</li>
 *   <li>Không hard-delete câu đã có {@code usageCount > 0} — chỉ deactivate.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final CategoryRepository categoryRepository;
    private final ProfileRepository  profileRepository;
    private final ChapterRepository  chapterRepository;

    /**
     * Self-reference qua Spring proxy — cho phép bulkCreateQuestions() gọi
     * createQuestion() qua proxy để mỗi câu chạy trong transaction riêng.
     * @Lazy tránh circular dependency khi Spring khởi động.
     */
    @Lazy
    @Autowired
    private QuestionService self;

    // ========================================================================
    // CRUD
    // ========================================================================

    /** Tạo câu hỏi mới, validate đúng 1 đáp án đúng. */
    @Transactional
    public QuestionResponse createQuestion(AuthenticatedUser me,
                                            CreateQuestionRequest req) {
        validateQuestionRequest(req);

        Profile teacher  = loadProfile(me.userId());
        Category category = loadCategory(req.categoryId());

        Chapter chapter = null;
        if (req.chapterId() != null) {
            chapter = loadChapter(req.chapterId());
        }

        // Validate: category phải khớp với course chứa chapter
        validateCategoryMatchesChapter(req.categoryId(), chapter);
        validateGradeMatchesChapter(req.categoryId(), req.grade(), chapter);

        // Validate: đúng 1 đáp án đúng
        long correctCount = req.choices().stream()
                .filter(CreateQuestionRequest.ChoiceRequest::isCorrect).count();
        if (correctCount != 1) {
            throw new BusinessException("INVALID_CHOICES",
                    "Câu hỏi phải có đúng 1 đáp án đúng (hiện có: " + correctCount + ").");
        }

        Question question = Question.create(teacher, category, req.grade(), chapter,
                req.content(), req.explanation(), req.difficulty(), req.type());

        // Tạo choices và gắn vào question trước khi save (cascade sẽ insert cùng)
        List<CreateQuestionRequest.ChoiceRequest> choiceReqs = req.choices();
        for (int i = 0; i < choiceReqs.size(); i++) {
            CreateQuestionRequest.ChoiceRequest cr = choiceReqs.get(i);
            QuestionChoice choice = QuestionChoice.create(question, cr.content(), cr.isCorrect(), i + 1);
            question.addChoice(choice);
        }

        Question saved = questionRepository.save(question);
        log.info("GV {} tạo câu hỏi {} (difficulty={})", me.userId(), saved.getId(),
                 saved.getDifficulty());
        return QuestionResponse.fromEntity(saved);
    }

    /** Danh sách câu hỏi của GV với filter tùy chọn. */
    @Transactional(readOnly = true)
    public PageResponse<QuestionResponse> listQuestions(AuthenticatedUser me,
                                                         UUID categoryId,
                                                         Integer grade,
                                                         UUID chapterId,
                                                         String difficulty,
                                                         String status,
                                                         Pageable pageable) {
        String resolvedStatus = status != null ? status : "active";
        Specification<Question> spec = (root, query, cb) ->
                cb.equal(root.get("teacher").get("id"), me.userId());

        spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), resolvedStatus));

        if (categoryId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("category").get("id"), categoryId));
        }
        if (grade != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("grade"), grade));
        }
        if (chapterId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("chapter").get("id"), chapterId));
        }
        if (difficulty != null && !difficulty.isBlank()) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("difficulty"), difficulty));
        }

        Page<Question> page = questionRepository.findAll(spec, pageable);

        return PageResponse.of(page, QuestionResponse::fromEntity);
    }

    /** Chi tiết một câu hỏi. */
    @Transactional(readOnly = true)
    public QuestionResponse getQuestion(UUID questionId, AuthenticatedUser me) {
        Question q = loadAndVerifyOwner(questionId, me.userId());
        return QuestionResponse.fromEntity(q);
    }

    /** Cập nhật câu hỏi — xóa và tạo lại toàn bộ choices. */
    @Transactional
    public QuestionResponse updateQuestion(UUID questionId, AuthenticatedUser me,
                                            CreateQuestionRequest req) {
        validateQuestionRequest(req);

        Question question = loadAndVerifyOwner(questionId, me.userId());

        long correctCount = req.choices().stream()
                .filter(CreateQuestionRequest.ChoiceRequest::isCorrect).count();
        if (correctCount != 1) {
            throw new BusinessException("INVALID_CHOICES",
                    "Câu hỏi phải có đúng 1 đáp án đúng.");
        }

        // Validate: category phải khớp với course chứa chapter mới (nếu có đổi chapter)
        Category category = loadCategory(req.categoryId());
        Chapter chapter = req.chapterId() != null ? loadChapter(req.chapterId()) : null;
        validateCategoryMatchesChapter(req.categoryId(), chapter);
        validateGradeMatchesChapter(req.categoryId(), req.grade(), chapter);

        question.update(category, req.grade(), chapter,
                req.content(), req.explanation(), req.difficulty());

        // Xóa toàn bộ choices cũ — orphanRemoval=true sẽ DELETE các bản ghi cũ khi flush
        question.clearChoices();

        // Tạo lại choices từ request
        List<CreateQuestionRequest.ChoiceRequest> choiceReqs = req.choices();
        for (int i = 0; i < choiceReqs.size(); i++) {
            CreateQuestionRequest.ChoiceRequest cr = choiceReqs.get(i);
            QuestionChoice choice = QuestionChoice.create(question, cr.content(), cr.isCorrect(), i + 1);
            question.addChoice(choice);
        }

        Question saved = questionRepository.save(question);
        log.info("GV {} cập nhật câu hỏi {} ({} đáp án)", me.userId(), questionId, choiceReqs.size());
        return QuestionResponse.fromEntity(saved);
    }

    /** Xóa câu hỏi — soft-delete nếu đã được dùng, hard-delete nếu chưa. */
    @Transactional
    public void deleteQuestion(UUID questionId, AuthenticatedUser me) {
        Question question = loadAndVerifyOwner(questionId, me.userId());

        if (question.getUsageCount() > 0) {
            // Câu đã dùng → chỉ deactivate để giữ lịch sử quiz
            question.deactivate();
            questionRepository.save(question);
            log.info("Deactivate câu hỏi {} (đã dùng {} lần)",
                     questionId, question.getUsageCount());
        } else {
            questionRepository.delete(question);
            log.info("Xóa câu hỏi {}", questionId);
        }
    }

    // ========================================================================
    // Bulk import
    // ========================================================================

    /**
     * Nhập hàng loạt câu hỏi từ Excel/AI parse.
     *
     * <p>KHÔNG đánh dấu @Transactional — mỗi câu được tạo trong transaction
     * riêng qua {@code self.createQuestion()} (gọi qua Spring proxy). Nhờ đó,
     * nếu một câu hỏi bị lỗi (validation / DB), transaction của câu đó bị rollback
     * nhưng các câu khác vẫn được commit bình thường.
     *
     * <p>Nếu dùng self-call trực tiếp {@code createQuestion()} (không qua proxy),
     * một DB exception sẽ mark toàn bộ transaction hiện tại là rollback-only,
     * khiến mọi câu hỏi sau đó cũng thất bại.
     */
    public BulkImportResult bulkCreateQuestions(AuthenticatedUser me,
                                                 List<CreateQuestionRequest> requests) {
        int created = 0;
        int failed  = 0;
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
                self.createQuestion(me, requests.get(i)); // qua proxy → transaction riêng
                created++;
            } catch (Exception e) {
                failed++;
                errors.add(new BulkImportError(i + 1, e.getMessage()));
                log.warn("Bulk import: bỏ qua câu {} — {}", i + 1, e.getMessage());
            }
        }
        log.info("Bulk import: {}/{} thành công", created, requests.size());
        return new BulkImportResult(created, failed, errors);
    }

    public record BulkImportResult(int created, int failed, List<BulkImportError> errors) {}

    public record BulkImportError(int row, String message) {}

    // ========================================================================
    // Stats cho quiz config UI
    // ========================================================================

    /**
     * Đếm câu hỏi active theo từng độ khó trong một chương.
     * GV xem để biết ngân hàng đủ câu chưa trước khi cấu hình quiz.
     */
    @Transactional(readOnly = true)
    public QuestionStatsResponse getStatsForChapter(AuthenticatedUser me, UUID chapterId) {
        loadChapter(chapterId);
        List<Object[]> rows =
                questionRepository.countActiveByDifficultyForTeacherAndChapter(
                        me.userId(), chapterId);

        int easy = 0, medium = 0, hard = 0;
        for (Object[] row : rows) {
            String diff  = (String) row[0];
            long   count = (Long) row[1];
            switch (diff) {
                case "easy"   -> easy   = (int) count;
                case "medium" -> medium = (int) count;
                case "hard"   -> hard   = (int) count;
            }
        }
        return new QuestionStatsResponse(easy, medium, hard, easy + medium + hard);
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private Question loadAndVerifyOwner(UUID questionId, UUID teacherId) {
        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", questionId));
        if (!q.getTeacher().getId().equals(teacherId)) {
            throw new BusinessException("FORBIDDEN",
                    "Bạn không có quyền chỉnh sửa câu hỏi này.",
                    HttpStatus.FORBIDDEN);
        }
        return q;
    }

    private Profile loadProfile(UUID id) {
        return profileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", id));
    }

    private void validateQuestionRequest(CreateQuestionRequest req) {
        if (req == null) {
            throw new BusinessException("INVALID_REQUEST", "Dữ liệu câu hỏi không hợp lệ.");
        }
        if (req.categoryId() == null) {
            throw new BusinessException("CATEGORY_REQUIRED", "Vui lòng chọn môn học.");
        }
        if (req.grade() == null || req.grade() < 1) {
            throw new BusinessException("GRADE_REQUIRED", "Vui lòng chọn lớp.");
        }
        if (req.content() == null || req.content().isBlank()) {
            throw new BusinessException("CONTENT_REQUIRED", "Nội dung câu hỏi không được trống.");
        }
        if (!List.of("easy", "medium", "hard").contains(req.difficulty())) {
            throw new BusinessException("INVALID_DIFFICULTY", "Độ khó phải là easy, medium hoặc hard.");
        }
        if (!List.of("multiple_choice", "true_false").contains(req.type())) {
            throw new BusinessException("INVALID_TYPE", "Loại câu hỏi không hợp lệ.");
        }
        if (req.choices() == null || req.choices().size() < 2 || req.choices().size() > 4) {
            throw new BusinessException("INVALID_CHOICES", "Câu hỏi phải có 2-4 đáp án.");
        }
        for (CreateQuestionRequest.ChoiceRequest choice : req.choices()) {
            if (choice == null || choice.content() == null || choice.content().isBlank()) {
                throw new BusinessException("INVALID_CHOICES", "Đáp án không được trống.");
            }
        }

        long correctCount = req.choices().stream()
                .filter(CreateQuestionRequest.ChoiceRequest::isCorrect)
                .count();
        if (correctCount != 1) {
            throw new BusinessException("INVALID_CHOICES",
                    "Câu hỏi phải có đúng 1 đáp án đúng (hiện có: " + correctCount + ").");
        }
    }

    private Category loadCategory(UUID id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }

    private Chapter loadChapter(UUID chapterId) {
        // findWithCourseById eager-loads course trong 1 query —
        // cần thiết để validateCategoryMatchesChapter() không trigger N+1
        return chapterRepository.findWithCourseById(chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));
    }

    /**
     * Đảm bảo categoryId của câu hỏi khớp với category của course chứa chapter.
     * Nếu không chọn chapter (câu hỏi cấp môn học), bỏ qua.
     */
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
            throw new BusinessException("GRADE_MISMATCH",
                    "Lớp không khớp với khóa học của chương đã chọn.");
        }
    }

    private List<Integer> courseGrades(Chapter chapter) {
        int[] grades = chapter.getCourse().getGrades();
        if (grades == null || grades.length == 0) {
            throw new BusinessException("COURSE_GRADE_MISSING",
                    "Khóa học của chương chưa có thông tin lớp.");
        }
        return Arrays.stream(grades).boxed().toList();
    }
}
