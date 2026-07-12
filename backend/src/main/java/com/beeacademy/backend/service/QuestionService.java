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
import com.beeacademy.backend.model.QuestionBank;
import com.beeacademy.backend.model.QuestionChoice;
import com.beeacademy.backend.repository.CategoryRepository;
import com.beeacademy.backend.repository.ChapterRepository;
import com.beeacademy.backend.repository.ProfileRepository;
import com.beeacademy.backend.repository.QuestionRepository;
import com.beeacademy.backend.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionService {

    private static final Set<String> OBJECTIVE_TYPES = Set.of(
            "multiple_choice", "true_false", "image_question", "audio_question");
    private static final Set<String> ESSAY_TYPES = Set.of(
            "essay", "essay_short", "essay_long");
    private static final Set<String> SUPPORTED_TYPES = Set.of(
            "multiple_choice",
            "true_false",
            "fill_in_blank",
            "matching",
            "essay",
            "essay_short",
            "essay_long",
            "image_question",
            "formula_question",
            "audio_question",
            "file_upload");

    private final QuestionRepository questionRepository;
    private final CategoryRepository categoryRepository;
    private final ProfileRepository profileRepository;
    private final ChapterRepository chapterRepository;
    private final ObjectMapper objectMapper;
    private final QuestionBankService questionBankService;

    @Lazy
    @Autowired
    private QuestionService self;

    @Transactional
    public QuestionResponse createQuestion(AuthenticatedUser me, CreateQuestionRequest req) {
        validateQuestionRequest(req);

        Profile teacher = loadProfile(me.userId());
        Category category = loadCategory(req.categoryId());
        Chapter chapter = req.chapterId() != null ? loadChapter(req.chapterId()) : null;
        QuestionBank questionBank = resolveQuestionBank(req.questionBankId(), me.userId(), req.categoryId(), req.grade());

        validateCategoryMatchesChapter(req.categoryId(), chapter);
        validateGradeMatchesChapter(req.categoryId(), req.grade(), chapter);

        Question question = Question.create(
                teacher,
                questionBank,
                category,
                req.grade(),
                chapter,
                req.content(),
                req.explanation(),
                serializeMetadata(req.metadata()),
                req.difficulty(),
                req.type());

        addChoices(question, req.choices());

        Question saved = questionRepository.save(question);
        log.info("Teacher {} created question {} type={}", me.userId(), saved.getId(), saved.getType());
        return QuestionResponse.fromEntity(saved, objectMapper);
    }

    @Transactional(readOnly = true)
    public PageResponse<QuestionResponse> listQuestions(
            AuthenticatedUser me,
            UUID categoryId,
            Integer grade,
            UUID questionBankId,
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
        if (questionBankId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("questionBank").get("id"), questionBankId));
        }
        if (chapterId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("chapter").get("id"), chapterId));
        }
        if (difficulty != null && !difficulty.isBlank()) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("difficulty"), difficulty));
        }

        Page<Question> page = questionRepository.findAll(spec, pageable);
        return PageResponse.of(page, question -> QuestionResponse.fromEntity(question, objectMapper));
    }

    @Transactional(readOnly = true)
    public QuestionResponse getQuestion(UUID questionId, AuthenticatedUser me) {
        Question q = loadAndVerifyOwner(questionId, me.userId());
        return QuestionResponse.fromEntity(q, objectMapper);
    }

    @Transactional
    public QuestionResponse updateQuestion(UUID questionId, AuthenticatedUser me, CreateQuestionRequest req) {
        validateQuestionRequest(req);

        Question question = loadAndVerifyOwner(questionId, me.userId());
        Category category = loadCategory(req.categoryId());
        Chapter chapter = req.chapterId() != null ? loadChapter(req.chapterId()) : null;
        QuestionBank questionBank = resolveQuestionBank(req.questionBankId(), me.userId(), req.categoryId(), req.grade());

        validateCategoryMatchesChapter(req.categoryId(), chapter);
        validateGradeMatchesChapter(req.categoryId(), req.grade(), chapter);

        question.update(
                questionBank,
                category,
                req.grade(),
                chapter,
                req.content(),
                req.explanation(),
                serializeMetadata(req.metadata()),
                req.difficulty(),
                req.type());

        question.clearChoices();
        addChoices(question, req.choices());

        Question saved = questionRepository.save(question);
        log.info("Teacher {} updated question {} type={}", me.userId(), questionId, saved.getType());
        return QuestionResponse.fromEntity(saved, objectMapper);
    }

    @Transactional
    public void deleteQuestion(UUID questionId, AuthenticatedUser me) {
        Question question = loadAndVerifyOwner(questionId, me.userId());

        if (question.getUsageCount() > 0) {
            question.deactivate();
            questionRepository.save(question);
            log.info("Deactivate question {} usage={}", questionId, question.getUsageCount());
        } else {
            questionRepository.delete(question);
            log.info("Delete question {}", questionId);
        }
    }

    public BulkImportResult bulkCreateQuestions(AuthenticatedUser me, List<CreateQuestionRequest> requests) {
        int created = 0;
        int failed = 0;
        List<BulkImportError> errors = new ArrayList<>();

        if (requests == null || requests.isEmpty()) {
            return new BulkImportResult(0, 0, errors);
        }

        if (requests.size() > 200) {
            throw new BusinessException("BULK_LIMIT_EXCEEDED", "Moi lan chi duoc nhap toi da 200 cau hoi.");
        }

        for (int i = 0; i < requests.size(); i++) {
            try {
                self.createQuestion(me, requests.get(i));
                created++;
            } catch (Exception e) {
                failed++;
                errors.add(new BulkImportError(i + 1, e.getMessage()));
                log.warn("Bulk import skip row {}: {}", i + 1, e.getMessage());
            }
        }
        return new BulkImportResult(created, failed, errors);
    }

    public record BulkImportResult(int created, int failed, List<BulkImportError> errors) {}

    public record BulkImportError(int row, String message) {}

    @Transactional(readOnly = true)
    public QuestionStatsResponse getStatsForChapter(AuthenticatedUser me, UUID chapterId) {
        loadChapter(chapterId);
        List<Object[]> rows = questionRepository.countActiveByDifficultyForTeacherAndChapter(me.userId(), chapterId);
        List<Object[]> typeRows = questionRepository.countActiveByTypeForTeacherAndChapter(me.userId(), chapterId);

        int easy = 0;
        int medium = 0;
        int hard = 0;
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
        int multipleChoiceCount = 0;
        int trueFalseCount = 0;
        int fillInBlankCount = 0;
        int essayCount = 0;
        for (Object[] row : typeRows) {
            String type = (String) row[0];
            long count = (Long) row[1];
            switch (type) {
                case "multiple_choice" -> multipleChoiceCount = (int) count;
                case "true_false" -> trueFalseCount = (int) count;
                case "fill_in_blank" -> fillInBlankCount = (int) count;
                case "essay", "essay_short", "essay_long" -> essayCount += (int) count;
                default -> {
                }
            }
        }
        int totalExamSupported = multipleChoiceCount + trueFalseCount + fillInBlankCount + essayCount;
        return new QuestionStatsResponse(
                easy,
                medium,
                hard,
                easy + medium + hard,
                multipleChoiceCount,
                trueFalseCount,
                fillInBlankCount,
                essayCount,
                totalExamSupported);
    }

    private void addChoices(Question question, List<CreateQuestionRequest.ChoiceRequest> choiceReqs) {
        List<CreateQuestionRequest.ChoiceRequest> safeChoices = choiceReqs != null ? choiceReqs : List.of();
        for (int i = 0; i < safeChoices.size(); i++) {
            CreateQuestionRequest.ChoiceRequest choiceRequest = safeChoices.get(i);
            QuestionChoice choice = QuestionChoice.create(question, choiceRequest.content(), choiceRequest.isCorrect(), i + 1);
            question.addChoice(choice);
        }
    }

    private Question loadAndVerifyOwner(UUID questionId, UUID teacherId) {
        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question", questionId));
        if (!q.getTeacher().getId().equals(teacherId)) {
            throw new BusinessException("FORBIDDEN", "Ban khong co quyen chinh sua cau hoi nay.", HttpStatus.FORBIDDEN);
        }
        return q;
    }

    private Profile loadProfile(UUID id) {
        return profileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Profile", id));
    }

    private Category loadCategory(UUID id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }

    private Chapter loadChapter(UUID chapterId) {
        return chapterRepository.findWithCourseById(chapterId)
                .orElseThrow(() -> new ResourceNotFoundException("Chapter", chapterId));
    }

    private QuestionBank resolveQuestionBank(UUID questionBankId, UUID teacherId, UUID categoryId, Integer grade) {
        if (questionBankId == null) {
            return null;
        }
        QuestionBank questionBank = questionBankService.getOwnedQuestionBank(questionBankId, teacherId);
        if (!questionBank.getCategory().getId().equals(categoryId)) {
            throw new BusinessException("QUESTION_BANK_CATEGORY_MISMATCH",
                    "Mon hoc cua cau hoi phai khop voi ngan hang da chon.");
        }
        if (!questionBank.getGrade().equals(grade)) {
            throw new BusinessException("QUESTION_BANK_GRADE_MISMATCH",
                    "Lop cua cau hoi phai khop voi ngan hang da chon.");
        }
        return questionBank;
    }

    private void validateQuestionRequest(CreateQuestionRequest req) {
        if (req == null) {
            throw new BusinessException("INVALID_REQUEST", "Du lieu cau hoi khong hop le.");
        }
        if (req.categoryId() == null) {
            throw new BusinessException("CATEGORY_REQUIRED", "Vui long chon mon hoc.");
        }
        if (req.grade() == null || req.grade() < 1) {
            throw new BusinessException("GRADE_REQUIRED", "Vui long chon lop.");
        }
        if (req.content() == null || req.content().isBlank()) {
            throw new BusinessException("CONTENT_REQUIRED", "Noi dung cau hoi khong duoc trong.");
        }
        if (!List.of("easy", "medium", "hard").contains(req.difficulty())) {
            throw new BusinessException("INVALID_DIFFICULTY", "Do kho phai la easy, medium hoac hard.");
        }
        if (!SUPPORTED_TYPES.contains(req.type())) {
            throw new BusinessException("INVALID_TYPE", "Loai cau hoi khong hop le.");
        }

        if (OBJECTIVE_TYPES.contains(req.type())) {
            validateObjectiveQuestion(req);
        } else if ("fill_in_blank".equals(req.type())) {
            validateFillInBlank(req);
        } else if ("matching".equals(req.type())) {
            validateMatching(req);
        } else if ("formula_question".equals(req.type())) {
            validateFormulaQuestion(req);
        } else if ("file_upload".equals(req.type())) {
            validateFileUpload(req);
        } else if (ESSAY_TYPES.contains(req.type())) {
            validateEssay(req);
        }

        validateReadingMetadata(req.metadata());
    }

    private void validateObjectiveQuestion(CreateQuestionRequest req) {
        if (req.choices() == null || req.choices().size() < 2 || req.choices().size() > 6) {
            throw new BusinessException("INVALID_CHOICES", "Cau hoi objective phai co 2-6 dap an.");
        }
        for (CreateQuestionRequest.ChoiceRequest choice : req.choices()) {
            if (choice == null || choice.content() == null || choice.content().isBlank()) {
                throw new BusinessException("INVALID_CHOICES", "Dap an khong duoc trong.");
            }
        }
        long correctCount = req.choices().stream()
                .filter(CreateQuestionRequest.ChoiceRequest::isCorrect)
                .count();
        if ("true_false".equals(req.type()) && correctCount != 1) {
            throw new BusinessException("INVALID_CHOICES", "Cau dung/sai phai co dung 1 dap an dung.");
        }
        if (!"true_false".equals(req.type()) && correctCount < 1) {
            throw new BusinessException("INVALID_CHOICES", "Cau hoi objective phai co it nhat 1 dap an dung.");
        }

        if ("image_question".equals(req.type())) {
            requireMetadataText(req.metadata(), "promptAssetUrl", "Cau hoi hinh anh can co URL hinh.");
        }
        if ("audio_question".equals(req.type())) {
            requireMetadataText(req.metadata(), "promptAssetUrl", "Cau hoi audio can co URL audio.");
        }
    }

    private void validateFillInBlank(CreateQuestionRequest req) {
        if (hasChoices(req)) {
            throw new BusinessException("INVALID_CHOICES", "Cau dien vao cho trong khong dung danh sach dap an objective.");
        }
        List<String> acceptedAnswers = stringList(req.metadata(), "acceptedAnswers");
        if (acceptedAnswers.isEmpty()) {
            throw new BusinessException("ACCEPTED_ANSWERS_REQUIRED", "Cau dien vao cho trong can it nhat 1 dap an hop le.");
        }
    }

    private void validateEssay(CreateQuestionRequest req) {
        if (hasChoices(req)) {
            throw new BusinessException("INVALID_CHOICES", "Cau tu luan khong dung danh sach dap an objective.");
        }
        Integer wordLimit = integerValue(req.metadata(), "wordLimit");
        if (wordLimit != null && wordLimit <= 0) {
            throw new BusinessException("INVALID_WORD_LIMIT", "wordLimit phai lon hon 0.");
        }
    }

    private void validateMatching(CreateQuestionRequest req) {
        if (hasChoices(req)) {
            throw new BusinessException("INVALID_CHOICES", "Cau noi cot khong dung danh sach dap an objective.");
        }
        JsonNode pairs = req.metadata() != null ? req.metadata().get("matchingPairs") : null;
        if (pairs == null || !pairs.isArray() || pairs.size() < 2) {
            throw new BusinessException("MATCHING_PAIRS_REQUIRED",
                    "Cau noi cot can it nhat 2 cap hop le.");
        }
    }

    private void validateFormulaQuestion(CreateQuestionRequest req) {
        requireMetadataText(req.metadata(), "formulaLatex",
                "Cau hoi cong thuc can co noi dung cong thuc.");
    }

    private void validateFileUpload(CreateQuestionRequest req) {
        if (hasChoices(req)) {
            throw new BusinessException("INVALID_CHOICES", "Cau nop file khong dung danh sach dap an objective.");
        }
        List<String> allowedUploadTypes = stringList(req.metadata(), "allowedUploadTypes");
        if (allowedUploadTypes.isEmpty()) {
            throw new BusinessException("UPLOAD_TYPES_REQUIRED",
                    "Cau nop file can khai bao loai file duoc phep.");
        }
    }

    private boolean hasChoices(CreateQuestionRequest req) {
        return req.choices() != null && !req.choices().isEmpty();
    }

    private void requireMetadataText(JsonNode metadata, String field, String message) {
        if (!hasText(metadata, field)) {
            throw new BusinessException("METADATA_REQUIRED", message);
        }
    }

    private boolean hasMetadataText(JsonNode metadata, String field) {
        return hasText(metadata, field);
    }

    private boolean hasText(JsonNode node, String field) {
        return node != null && node.hasNonNull(field) && !node.get(field).asText("").isBlank();
    }

    private List<String> stringList(JsonNode metadata, String field) {
        if (metadata == null) return List.of();
        JsonNode values = metadata.path(field);
        if (!values.isArray()) return List.of();
        List<String> result = new ArrayList<>();
        values.forEach(item -> {
            String value = item.asText("").trim();
            if (!value.isBlank()) {
                result.add(value);
            }
        });
        return result;
    }

    private Integer integerValue(JsonNode metadata, String field) {
        if (metadata == null || !metadata.hasNonNull(field)) return null;
        JsonNode value = metadata.get(field);
        return value.isNumber() ? value.intValue() : null;
    }

    private void validateReadingMetadata(JsonNode metadata) {
        if (metadata == null) return;

        boolean hasReadingSetId = hasText(metadata, "readingSetId");
        boolean hasSharedPrompt = hasText(metadata, "sharedPrompt");
        boolean hasSharedPromptTitle = hasText(metadata, "sharedPromptTitle");
        Integer questionOrderInSet = integerValue(metadata, "questionOrderInSet");

        if (!hasReadingSetId && !hasSharedPrompt && !hasSharedPromptTitle && questionOrderInSet == null) {
            return;
        }
        if (!hasReadingSetId) {
            throw new BusinessException("READING_SET_REQUIRED", "Cau hoi bai doc can co readingSetId.");
        }
        if (!hasSharedPrompt) {
            throw new BusinessException("SHARED_PROMPT_REQUIRED", "Cau hoi bai doc can co doan van chung.");
        }
        if (questionOrderInSet != null && questionOrderInSet <= 0) {
            throw new BusinessException("INVALID_READING_ORDER", "questionOrderInSet phai lon hon 0.");
        }
    }

    private String serializeMetadata(JsonNode metadata) {
        if (metadata == null || metadata.isNull() || metadata.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (Exception ex) {
            throw new BusinessException("INVALID_METADATA", "Khong the luu metadata cau hoi.");
        }
    }

    private void validateCategoryMatchesChapter(UUID requestedCategoryId, Chapter chapter) {
        if (chapter == null) return;
        Category courseCategory = chapter.getCourse().getCategory();
        if (courseCategory == null) return;
        if (!courseCategory.getId().equals(requestedCategoryId)) {
            throw new BusinessException("CATEGORY_MISMATCH",
                    "Mon hoc khong khop voi khoa hoc cua chuong da chon. Chuong nay thuoc mon: "
                            + courseCategory.getName() + ".");
        }
    }

    private void validateGradeMatchesChapter(UUID requestedCategoryId, Integer grade, Chapter chapter) {
        if (chapter == null || grade == null) return;
        validateCategoryMatchesChapter(requestedCategoryId, chapter);
        if (!courseGrades(chapter).contains(grade)) {
            throw new BusinessException("GRADE_MISMATCH", "Lop khong khop voi khoa hoc cua chuong da chon.");
        }
    }

    private List<Integer> courseGrades(Chapter chapter) {
        int[] grades = chapter.getCourse().getGrades();
        if (grades == null || grades.length == 0) {
            throw new BusinessException("COURSE_GRADE_MISSING", "Khoa hoc cua chuong chua co thong tin lop.");
        }
        return Arrays.stream(grades).boxed().toList();
    }
}
