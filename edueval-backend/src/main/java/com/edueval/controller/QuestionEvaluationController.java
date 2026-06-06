package com.edueval.controller;

import com.edueval.dto.response.QuestionEvaluationResponse;
import com.edueval.dto.request.QuestionOverrideRequest;
import com.edueval.service.QuestionEvaluationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class QuestionEvaluationController {

    private final QuestionEvaluationService questionEvaluationService;

    /**
     * GET /api/submissions/{submissionId}/question-evaluations
     * Returns per-question breakdown for a submission.
     * Accessible by teacher and the submitting student.
     */
    @GetMapping("/submissions/{submissionId}/question-evaluations")
    public ResponseEntity<List<QuestionEvaluationResponse>> getEvaluations(
            @PathVariable UUID submissionId) {
        return ResponseEntity.ok(questionEvaluationService.getForSubmission(submissionId));
    }

    /**
     * PATCH /api/teacher/question-submissions/{questionSubmissionId}/review
     * Teacher overrides marks for a single question.
     */
    @PatchMapping("/teacher/question-submissions/{questionSubmissionId}/review")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<QuestionEvaluationResponse> override(
            @PathVariable UUID questionSubmissionId,
            @RequestBody QuestionOverrideRequest req,
            @AuthenticationPrincipal org.springframework.security.core.userdetails.UserDetails userDetails) {

        // Resolve teacher UUID from your security context — adapt to your UserDetails impl
        UUID teacherId = UUID.fromString(userDetails.getUsername());
        return ResponseEntity.ok(
                questionEvaluationService.overrideQuestion(questionSubmissionId, req, teacherId));
    }
}