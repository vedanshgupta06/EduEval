package com.edueval.dto.request;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;

public record CreateExamRequest(

        @NotBlank(message = "Exam title is required")
        @Size(max = 200, message = "Title cannot exceed 200 characters")
        String title,

        // Null/ignored for multi-question exams (total is auto-calculated)
        Integer totalMarks,

        @NotNull(message = "Deadline is required")
        @Future(message = "Deadline must be in the future")
        LocalDateTime deadline,

        // Optional: path to a pre-uploaded model answer file
        String modelAnswerUrl,

        // Optional: typed model answer text used directly by AI engine
        String modelAnswerText,

        // Multi-question support
        Boolean isMultiQuestion,

        List<QuestionRequest> questions

) {}