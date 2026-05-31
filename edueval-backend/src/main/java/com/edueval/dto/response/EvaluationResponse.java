package com.edueval.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record EvaluationResponse(
        UUID id,
        UUID submissionId,
        String studentName,
        String examTitle,

        // AI results
        Double aiMarks,
        Double aiConfidence,
        String aiFeedbackJson,

        // Teacher review
        Double teacherMarks,
        String teacherComment,
        String reviewedBy,
        LocalDateTime reviewedAt,

        // Derived
        Double finalMarks,
        boolean reviewed
) {}
