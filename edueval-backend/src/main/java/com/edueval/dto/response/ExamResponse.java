package com.edueval.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record ExamResponse(
        UUID id,
        String title,
        Integer totalMarks,
        LocalDateTime deadline,
        String modelAnswerUrl,
        String modelAnswerText,
        UUID classroomId,
        String classroomName,
        String teacherName,
        long submissionCount,
        LocalDateTime createdAt
) {}
