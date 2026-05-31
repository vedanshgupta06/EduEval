package com.edueval.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateClassroomRequest(

        @NotBlank(message = "Classroom name is required")
        @Size(min = 3, max = 100, message = "Name must be between 3 and 100 characters")
        String className

) {}
