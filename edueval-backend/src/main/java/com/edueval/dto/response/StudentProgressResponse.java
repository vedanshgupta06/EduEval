package com.edueval.dto.response;

import java.time.LocalDateTime;
import java.util.UUID;

public record StudentProgressResponse(
        UUID submissionId,
        UUID examId,
        String examTitle,
        String classroomName,
        int totalMarks,
        Double marksObtained,    // null until evaluated
        Double percentage,       // null until evaluated
        boolean reviewed,
        LocalDateTime submittedAt
) {}
