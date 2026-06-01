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
        String classroomName,
        Integer totalMarks,
        String fileUrl,
        SubmissionStatus status,
        Double aiMarks,
        Double finalMarks,
        LocalDateTime submittedAt
) {}
