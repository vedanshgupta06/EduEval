package com.edueval.controller;

import com.edueval.dto.request.*;
import com.edueval.dto.response.*;
import com.edueval.service.AssessmentReportService;
import com.edueval.service.AssessmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AssessmentController {

    private final AssessmentService assessmentService;
    private final AssessmentReportService reportService;

    private static final DateTimeFormatter FILE_DATE =
            DateTimeFormatter.ofPattern("yyyy-MM-dd");

    // ── Teacher endpoints ─────────────────────────────────────────────────────

    /** POST /api/teacher/classrooms/{classroomId}/assessments */
    @PostMapping("/api/teacher/classrooms/{classroomId}/assessments")
    public ResponseEntity<AssessmentResponse> createAssessment(
            @PathVariable UUID classroomId,
            @Valid @RequestBody CreateAssessmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(assessmentService.createAssessment(classroomId, request));
    }

    /** GET /api/teacher/assessments/{assessmentId}/results */
    @GetMapping("/api/teacher/assessments/{assessmentId}/results")
    public ResponseEntity<List<AssessmentSubmissionResponse>> getResults(
            @PathVariable UUID assessmentId) {
        return ResponseEntity.ok(assessmentService.getResults(assessmentId));
    }

    /** POST /api/teacher/assessments/{assessmentId}/override */
    @PostMapping("/api/teacher/assessments/{assessmentId}/override")
    public ResponseEntity<AssessmentAnswerResponse> overrideMarks(
            @PathVariable UUID assessmentId,
            @RequestBody TeacherAssessmentOverrideRequest request) {
        return ResponseEntity.ok(assessmentService.overrideAnswerMarks(assessmentId, request));
    }

    /** GET /api/teacher/reports/assessment/{assessmentId} — Excel download */
    @GetMapping("/api/teacher/reports/assessment/{assessmentId}")
    public ResponseEntity<byte[]> downloadReport(
            @PathVariable UUID assessmentId) throws IOException {
        byte[] report = reportService.generateAssessmentReport(assessmentId);
        String filename = "EduEval_Assessment_Report_"
                + LocalDateTime.now().format(FILE_DATE) + ".xlsx";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .body(report);
    }

    // ── Shared endpoints (auth required, role checked in service) ─────────────

    /** GET /api/classrooms/{classroomId}/assessments */
    @GetMapping("/api/classrooms/{classroomId}/assessments")
    public ResponseEntity<List<AssessmentResponse>> getAssessmentsForClassroom(
            @PathVariable UUID classroomId) {
        return ResponseEntity.ok(assessmentService.getAssessmentsForClassroom(classroomId));
    }

    /**
     * GET /api/assessments/{assessmentId}
     * Students get this WITHOUT correct answers.
     * Teachers should use the results endpoint instead.
     */
    @GetMapping("/api/assessments/{assessmentId}")
    public ResponseEntity<AssessmentResponse> getAssessment(
            @PathVariable UUID assessmentId) {
        return ResponseEntity.ok(assessmentService.getAssessment(assessmentId, false));
    }

    // ── Student endpoints ─────────────────────────────────────────────────────

    /** POST /api/student/assessments/{assessmentId}/submit */
    @PostMapping("/api/student/assessments/{assessmentId}/submit")
    public ResponseEntity<AssessmentSubmissionResponse> submit(
            @PathVariable UUID assessmentId,
            @Valid @RequestBody SubmitAssessmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(assessmentService.submitAssessment(assessmentId, request));
    }

    /** GET /api/student/assessments/{assessmentId}/my-submission */
    @GetMapping("/api/student/assessments/{assessmentId}/my-submission")
    public ResponseEntity<AssessmentSubmissionResponse> getMySubmission(
            @PathVariable UUID assessmentId) {
        return ResponseEntity.ok(assessmentService.getMySubmission(assessmentId));
    }
}
