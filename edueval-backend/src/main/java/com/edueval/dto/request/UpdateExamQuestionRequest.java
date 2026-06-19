package com.edueval.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record UpdateExamQuestionRequest(
        @NotBlank(message = "Question text is required")
        String questionText,

        @NotNull(message = "Marks are required")
        @Positive(message = "Marks must be a positive number")
        Integer marks,

        @NotBlank(message = "Model answer is required")
        String modelAnswerText
) {}
