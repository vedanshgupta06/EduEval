package com.edueval.controller;

import com.edueval.dto.response.ClassroomAnalyticsResponse;
import com.edueval.dto.response.ExamAnalyticsResponse;
import com.edueval.dto.response.StudentProgressResponse;
import com.edueval.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    // GET /api/teacher/exams/{id}/analytics
    @GetMapping("/api/teacher/exams/{examId}/analytics")
    public ResponseEntity<ExamAnalyticsResponse> getExamAnalytics(
            @PathVariable UUID examId) {
        return ResponseEntity.ok(analyticsService.getExamAnalytics(examId));
    }

    // GET /api/teacher/classrooms/{id}/analytics
    @GetMapping("/api/teacher/classrooms/{classroomId}/analytics")
    public ResponseEntity<ClassroomAnalyticsResponse> getClassroomAnalytics(
            @PathVariable UUID classroomId) {
        return ResponseEntity.ok(analyticsService.getClassroomAnalytics(classroomId));
    }

    // GET /api/student/analytics
    @GetMapping("/api/student/analytics")
    public ResponseEntity<List<StudentProgressResponse>> getStudentProgress() {
        return ResponseEntity.ok(analyticsService.getStudentProgress());
    }
}
