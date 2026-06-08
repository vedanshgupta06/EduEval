package com.edueval.controller;

import com.edueval.service.QuestionSubmissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class QuestionSubmissionController {

    private final QuestionSubmissionService questionSubmissionService;

    /**
     * POST /api/submissions/{submissionId}/questions/{questionId}/upload
     * Student uploads a file for one question.
     * Can be called repeatedly (re-upload) before evaluation is triggered.
     */
    @PostMapping("/submissions/{submissionId}/questions/{questionId}/upload")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> uploadQuestionFile(
            @PathVariable UUID submissionId,
            @PathVariable UUID questionId,
            @RequestParam("file") MultipartFile file) throws Exception {

        var qs = questionSubmissionService.uploadQuestionFile(submissionId, questionId, file);
        return ResponseEntity.ok(Map.of(
                "questionSubmissionId", qs.getId(),
                "status", qs.getStatus(),
                "fileUrl", qs.getFileUrl()
        ));
    }

    /**
     * POST /api/submissions/{submissionId}/questions/upload-all
     * Student uploads one answer sheet containing answers for all questions.
     */
    @PostMapping("/submissions/{submissionId}/questions/upload-all")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> uploadAnswerSheetForAllQuestions(
            @PathVariable UUID submissionId,
            @RequestParam("file") MultipartFile file) {

        var submissions = questionSubmissionService
                .uploadAnswerSheetForAllQuestions(submissionId, file);
        List<UUID> ids = submissions.stream().map(qs -> qs.getId()).toList();
        return ResponseEntity.ok(Map.of(
                "questionSubmissionIds", ids,
                "questionCount", submissions.size(),
                "status", "PENDING"
        ));
    }

    /**
     * POST /api/submissions/{submissionId}/evaluate-questions
     * Called after the student finishes uploading all question files.
     * Triggers AI evaluation for every question in this submission.
     * Runs synchronously (small exam); make async if needed.
     */
    @PostMapping("/submissions/{submissionId}/evaluate-questions")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<?> triggerEvaluation(@PathVariable UUID submissionId) {
        var result = questionSubmissionService.evaluateAllQuestions(submissionId);
        return ResponseEntity.ok(Map.of(
                "message", "Evaluation completed for all questions",
                "attempted", result.attempted(),
                "succeeded", result.succeeded()
        ));
    }

    /**
     * POST /api/teacher/question-submissions/{id}/re-evaluate
     * Teacher triggers re-evaluation for a single question.
     */
    @PostMapping("/teacher/question-submissions/{id}/re-evaluate")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<?> reEvaluate(@PathVariable UUID id) {
        questionSubmissionService.reEvaluateSingle(id);
        return ResponseEntity.ok(Map.of("message", "Re-evaluation triggered"));
    }
}
