package com.edueval.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record TeacherReviewRequest(

        @NotNull(message = "Marks are required")
        @PositiveOrZero(message = "Marks cannot be negative")
        Double marks,

        String comment

) {}
