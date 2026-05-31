package com.edueval.dto.response;

import java.util.List;
import java.util.UUID;

public record ClassroomAnalyticsResponse(
        UUID classroomId,
        String classroomName,
        long totalStudents,
        long totalExams,
        double overallAverageMarks,   // avg across all exams in this classroom
        List<ExamAnalyticsResponse> examBreakdown
) {}
