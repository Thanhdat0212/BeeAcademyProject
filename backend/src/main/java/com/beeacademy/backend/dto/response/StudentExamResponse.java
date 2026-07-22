package com.beeacademy.backend.dto.response;

import com.beeacademy.backend.model.ExamConfig;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Random;
import java.util.UUID;

public record StudentExamResponse(
        UUID id,
        UUID courseId,
        Integer slotIndex,
        UUID scopeStartChapterId,
        String scopeStartChapterTitle,
        UUID placementChapterId,
        String placementChapterTitle,
        String examType,
        String name,
        String description,
        Integer durationMinutes,
        Integer passScorePercent,
        Integer maxAttempts,
        Boolean shuffleQuestions,
        Boolean shuffleOptions,
        Boolean showAnswerAfterSubmit,
        Boolean requireFullscreen,
        Boolean blockCopyPaste,
        Integer questionCount,
        Double totalPoints,
        List<StudentExamQuestionResponse> questions,
        Instant updatedAt
) {
    private static final int REQUIRED_EXAM_MAX_ATTEMPTS = 3;

    public record StudentExamQuestionResponse(
            String id,
            String text,
            String type,
            List<String> options,
            JsonNode metadata,
            Double points,
            String difficulty
    ) {}

    private record StoredExamQuestion(
            String id,
            UUID questionVersionId,
            String text,
            String type,
            List<String> options,
            List<Integer> correctIndices,
            JsonNode metadata,
            String explanation,
            Double points,
            String difficulty
    ) {}

    public static StudentExamResponse fromEntity(ExamConfig config, ObjectMapper mapper, UUID studentId) {
        List<StudentExamQuestionResponse> questions = parseQuestions(config.getQuestionsJson(), mapper);
        questions = shuffleForStudent(
                questions,
                mapper,
                studentId,
                config.getId(),
                Boolean.TRUE.equals(config.getShuffleQuestions()),
                Boolean.TRUE.equals(config.getShuffleOptions()));
        double totalPoints = questions.stream()
                .map(StudentExamQuestionResponse::points)
                .filter(point -> point != null)
                .mapToDouble(Double::doubleValue)
                .sum();
        return new StudentExamResponse(
                config.getId(),
                config.getCourse().getId(),
                config.getSlotIndex(),
                config.getScopeStartChapter() != null ? config.getScopeStartChapter().getId() : null,
                config.getScopeStartChapter() != null ? config.getScopeStartChapter().getTitle() : null,
                config.getPlacementChapter() != null ? config.getPlacementChapter().getId() : null,
                config.getPlacementChapter() != null ? config.getPlacementChapter().getTitle() : null,
                config.getExamType(),
                config.getName(),
                config.getDescription(),
                config.getDurationMinutes(),
                config.getPassScorePercent(),
                REQUIRED_EXAM_MAX_ATTEMPTS,
                config.getShuffleQuestions(),
                config.getShuffleOptions(),
                config.getShowAnswerAfterSubmit(),
                true,
                true,
                questions.size(),
                totalPoints,
                questions,
                config.getUpdatedAt()
        );
    }

    private static List<StudentExamQuestionResponse> parseQuestions(String json, ObjectMapper mapper) {
        try {
            List<StoredExamQuestion> questions = readQuestions(json, mapper);
            return questions.stream()
                    .map(question -> new StudentExamQuestionResponse(
                            question.id(),
                            question.text(),
                            question.type(),
                            question.options() != null ? question.options() : List.of(),
                            question.metadata(),
                            question.points(),
                            question.difficulty()
                    ))
                    .toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    private static List<StudentExamQuestionResponse> shuffleForStudent(
            List<StudentExamQuestionResponse> questions,
            ObjectMapper mapper,
            UUID studentId,
            UUID examConfigId,
            boolean shuffleQuestions,
            boolean shuffleOptions) {
        List<StudentExamQuestionResponse> result = new ArrayList<>(questions);
        Random random = new Random(Objects.hash(studentId, examConfigId));
        if (shuffleQuestions) {
            Collections.shuffle(result, random);
        }
        if (!shuffleOptions) {
            return result;
        }
        return result.stream()
                .map(question -> shuffleOptions(question, mapper, random))
                .toList();
    }

    private static StudentExamQuestionResponse shuffleOptions(
            StudentExamQuestionResponse question,
            ObjectMapper mapper,
            Random random) {
        if (question.options() == null || question.options().size() < 2) {
            return question;
        }
        List<Integer> optionIndexMap = new ArrayList<>();
        for (int i = 0; i < question.options().size(); i++) {
            optionIndexMap.add(i);
        }
        Collections.shuffle(optionIndexMap, random);
        List<String> shuffledOptions = optionIndexMap.stream()
                .map(question.options()::get)
                .toList();

        ObjectNode metadata = question.metadata() != null && question.metadata().isObject()
                ? question.metadata().deepCopy()
                : mapper.createObjectNode();
        metadata.set("optionIndexMap", mapper.valueToTree(optionIndexMap));

        // Ảnh đáp án phải xáo cùng thứ tự với options, nếu không câu hỏi ảnh sẽ lệch ảnh/đáp án.
        JsonNode optionImages = metadata.get("optionImages");
        if (optionImages != null && optionImages.isArray()
                && optionImages.size() == question.options().size()) {
            List<String> shuffledImages = optionIndexMap.stream()
                    .map(index -> optionImages.get(index).asText(""))
                    .toList();
            metadata.set("optionImages", mapper.valueToTree(shuffledImages));
        }

        return new StudentExamQuestionResponse(
                question.id(),
                question.text(),
                question.type(),
                shuffledOptions,
                metadata,
                question.points(),
                question.difficulty());
    }

    private static List<StoredExamQuestion> readQuestions(String json, ObjectMapper mapper) throws Exception {
        try {
            return mapper.readValue(json, new TypeReference<List<StoredExamQuestion>>() {});
        } catch (Exception first) {
            String unwrapped = mapper.readValue(json, String.class);
            return mapper.readValue(unwrapped, new TypeReference<List<StoredExamQuestion>>() {});
        }
    }
}
