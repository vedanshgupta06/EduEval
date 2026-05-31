package com.edueval.dto.request;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public record UpdateExamRequest(

        @Size(max = 200, message = "Title cannot exceed 200 characters")
        String title,

        @Positive(message = "Total marks must be a positive number")
        Integer totalMarks,

        @Future(message = "Deadline must be in the future")
        LocalDateTime deadline,

        String modelAnswerUrl,
        String modelAnswerText

) {}
