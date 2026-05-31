package com.edueval.controller;

import com.edueval.dto.request.TeacherReviewRequest;
import com.edueval.dto.response.EvaluationResponse;
import com.edueval.service.EvaluationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class EvaluationController {

    private final EvaluationService evaluationService;

    // GET /api/evaluations/{submissionId}
    @GetMapping("/api/evaluations/{submissionId}")
    public ResponseEntity<EvaluationResponse> getEvaluation(
            @PathVariable UUID submissionId) {
        return ResponseEntity.ok(evaluationService.getEvaluationBySubmission(submissionId));
    }

    // PATCH /api/teacher/evaluations/{id}/review
    @PatchMapping("/api/teacher/evaluations/{id}/review")
    public ResponseEntity<EvaluationResponse> reviewEvaluation(
            @PathVariable UUID id,
            @Valid @RequestBody TeacherReviewRequest request) {
        return ResponseEntity.ok(evaluationService.applyTeacherReview(id, request));
    }

    // POST /api/teacher/evaluations/{id}/re-evaluate
    @PostMapping("/api/teacher/evaluations/{id}/re-evaluate")
    public ResponseEntity<Void> reEvaluate(@PathVariable UUID id) {
        evaluationService.triggerReEvaluation(id);
        return ResponseEntity.accepted().build();
    }

    // GET /api/teacher/exams/{id}/review-queue
    @GetMapping("/api/teacher/exams/{examId}/review-queue")
    public ResponseEntity<List<EvaluationResponse>> getReviewQueue(
            @PathVariable UUID examId) {
        return ResponseEntity.ok(evaluationService.getPendingReviewQueue(examId));
    }
}
