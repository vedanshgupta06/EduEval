package com.edueval.dto.response;

import java.util.UUID;

public record ExamAnalyticsResponse(
        UUID examId,
        String examTitle,
        int totalMarks,
        long totalStudents,        // students enrolled in classroom
        long submissionCount,      // how many actually submitted
        double submissionRate,     // submissionCount / totalStudents * 100
        Double averageMarks,       // null if no evaluated submissions yet
        Double highestMarks,
        Double lowestMarks,
        long pendingReviewCount,   // AI evaluated but teacher hasn't reviewed
        long reviewedCount
) {}
