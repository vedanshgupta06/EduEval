package com.edueval.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDateTime;
import java.util.List;

public record CreateAssessmentRequest(

        @NotBlank(message = "Title is required")
        @Size(max = 200)
        String title,

        String description,

        @NotNull(message = "Deadline is required")
        @Future(message = "Deadline must be in the future")
        LocalDateTime deadline,

        // Optional time limit in minutes
        Integer durationMinutes,

        @NotEmpty(message = "At least one question is required")
        @Valid
        List<AssessmentQuestionRequest> questions

) {}