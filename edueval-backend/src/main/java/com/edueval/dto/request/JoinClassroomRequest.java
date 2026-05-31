package com.edueval.dto.request;

import jakarta.validation.constraints.NotBlank;

public record JoinClassroomRequest(

        @NotBlank(message = "Class code is required")
        String classCode

) {}
