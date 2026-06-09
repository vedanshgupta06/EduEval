package com.edueval.dto.request;

import java.util.UUID;

public record TeacherAssessmentOverrideRequest(
        UUID answerId,
        Double marks,
        String comment
) {}