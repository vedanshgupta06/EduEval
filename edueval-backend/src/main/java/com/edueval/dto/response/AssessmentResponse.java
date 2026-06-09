package com.edueval.dto.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record AssessmentResponse(
        UUID id,
        String title,
        String description,
        Integer totalMarks,
        LocalDateTime deadline,
        Integer durationMinutes,
        List<AssessmentQuestionResponse> questions,
        LocalDateTime createdAt
) {}