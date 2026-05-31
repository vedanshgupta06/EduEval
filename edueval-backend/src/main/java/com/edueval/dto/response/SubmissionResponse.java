package com.edueval.dto.response;

import com.edueval.enums.SubmissionStatus;
import java.time.LocalDateTime;
import java.util.UUID;

public record SubmissionResponse(
        UUID id,
        UUID examId,
        String examTitle,
        UUID studentId,
        String studentName,
        String fileUrl,
        SubmissionStatus status,
        LocalDateTime submittedAt
) {}
