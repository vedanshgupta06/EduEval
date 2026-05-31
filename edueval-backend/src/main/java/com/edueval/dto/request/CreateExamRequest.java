package com.edueval.dto.request;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

public record CreateExamRequest(

        @NotBlank(message = "Exam title is required")
        @Size(max = 200, message = "Title cannot exceed 200 characters")
        String title,

        @NotNull(message = "Total marks are required")
        @Positive(message = "Total marks must be a positive number")
        Integer totalMarks,

        @NotNull(message = "Deadline is required")
        @Future(message = "Deadline must be in the future")
        LocalDateTime deadline,

        // Optional: path to a pre-uploaded model answer file
        String modelAnswerUrl,

        // Optional: typed model answer text used directly by AI engine
        String modelAnswerText

) {}
