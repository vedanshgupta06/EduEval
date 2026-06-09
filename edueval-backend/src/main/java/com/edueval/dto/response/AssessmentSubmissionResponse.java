package com.edueval.dto.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record AssessmentSubmissionResponse(
        UUID id,
        UUID assessmentId,
        String studentName,
        String studentEmail,
        Double totalMarksObtained,
        Integer totalMarks,
        String status,
        List<AssessmentAnswerResponse> answers,
        LocalDateTime submittedAt
) {}