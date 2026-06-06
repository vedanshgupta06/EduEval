package com.edueval.controller;

import com.edueval.dto.request.UpdateSubmissionStatusRequest;
import com.edueval.dto.response.SubmissionResponse;
import com.edueval.service.SubmissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;

    // POST /api/student/exams/{id}/submit  (multipart — existing single-answer)
    @PostMapping("/api/student/exams/{examId}/submit")
    public ResponseEntity<SubmissionResponse> submit(
            @PathVariable UUID examId,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(submissionService.submitAnswerSheet(examId, file));
    }

    // POST /api/student/exams/{id}/submit-multi  (NEW — multi-question, no file)
    // Creates the parent Submission row so the student can upload per-question files.
    @PostMapping("/api/student/exams/{examId}/submit-multi")
    public ResponseEntity<SubmissionResponse> submitMulti(@PathVariable UUID examId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(submissionService.createMultiQuestionSubmission(examId));
    }

    // GET /api/student/submissions
    @GetMapping("/api/student/submissions")
    public ResponseEntity<List<SubmissionResponse>> getStudentSubmissions() {
        return ResponseEntity.ok(submissionService.getStudentSubmissions());
    }

    // GET /api/teacher/exams/{id}/submissions
    @GetMapping("/api/teacher/exams/{examId}/submissions")
    public ResponseEntity<List<SubmissionResponse>> getSubmissionsForExam(
            @PathVariable UUID examId) {
        return ResponseEntity.ok(submissionService.getSubmissionsForExam(examId));
    }

    // GET /api/submissions/{id}
    @GetMapping("/api/submissions/{id}")
    public ResponseEntity<SubmissionResponse> getSubmissionById(@PathVariable UUID id) {
        return ResponseEntity.ok(submissionService.getSubmissionById(id));
    }

    // PATCH /api/teacher/submissions/{id}/status
    @PatchMapping("/api/teacher/submissions/{id}/status")
    public ResponseEntity<SubmissionResponse> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateSubmissionStatusRequest request) {
        return ResponseEntity.ok(
                submissionService.updateSubmissionStatus(id, request.status()));
    }
}