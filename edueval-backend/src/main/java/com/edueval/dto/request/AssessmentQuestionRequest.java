package com.edueval.dto.request;

import jakarta.validation.constraints.*;

import java.util.List;

public record AssessmentQuestionRequest(

        @NotBlank(message = "Question text is required")
        String questionText,

        @NotBlank(message = "Question type is required")
        // "MCQ" | "MULTI_SELECT" | "DESCRIPTIVE"
        String questionType,

        @NotNull @Min(1)
        Integer marks,

        // Required for MCQ and MULTI_SELECT
        List<String> options,

        // Required for MCQ and MULTI_SELECT — list of correct 0-based option indices
        List<Integer> correctAnswers,

        // Required for DESCRIPTIVE
        String modelAnswerText,

        // "PROPORTIONAL" | "STRICT" — only relevant for MULTI_SELECT
        String scoringMode

) {}