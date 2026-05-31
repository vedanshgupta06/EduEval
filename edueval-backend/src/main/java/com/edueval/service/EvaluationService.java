package com.edueval.service;

import com.edueval.dto.request.TeacherReviewRequest;
import com.edueval.dto.response.EvaluationResponse;
import com.edueval.entity.Evaluation;
import com.edueval.entity.Exam;
import com.edueval.entity.Submission;
import com.edueval.entity.User;
import com.edueval.enums.SubmissionStatus;
import com.edueval.exception.ResourceNotFoundException;
import com.edueval.exception.UnauthorizedActionException;
import com.edueval.repository.EvaluationRepository;
import com.edueval.repository.SubmissionRepository;
import com.edueval.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluationService {

    private final EvaluationRepository evaluationRepository;
    private final SubmissionRepository submissionRepository;
    private final AiEngineService aiEngineService;
    private final UserRepository userRepository;

    // Jackson ObjectMapper — thread-safe, reuse the same instance
    private final ObjectMapper objectMapper = new ObjectMapper();

    // ── Shared ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public EvaluationResponse getEvaluationBySubmission(UUID submissionId) {
        Evaluation evaluation = evaluationRepository.findBySubmissionId(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No evaluation found for submission: " + submissionId));
        return toResponse(evaluation);
    }

    // ── Teacher ──────────────────────────────────────────────────────────────

    @Transactional
    public EvaluationResponse applyTeacherReview(UUID evaluationId, TeacherReviewRequest request) {
        Evaluation evaluation = findById(evaluationId);
        requireTeacherOwnership(evaluation.getSubmission().getExam());

        // Validate marks don't exceed total
        double totalMarks = evaluation.getSubmission().getExam().getTotalMarks();
        if (request.marks() > totalMarks) {
            throw new IllegalArgumentException(
                    "Marks cannot exceed total marks for this exam (" + totalMarks + ")");
        }

        User reviewer = currentUser();
        evaluation.setTeacherMarks(request.marks());
        evaluation.setTeacherComment(request.comment());
        evaluation.setReviewedBy(reviewer);
        evaluation.setReviewedAt(LocalDateTime.now());

        Submission submission = evaluation.getSubmission();
        submission.setStatus(SubmissionStatus.REVIEWED);
        submissionRepository.save(submission);

        return toResponse(evaluationRepository.save(evaluation));
    }

    @Transactional
    public void triggerReEvaluation(UUID evaluationId) {
        Evaluation evaluation = findById(evaluationId);
        requireTeacherOwnership(evaluation.getSubmission().getExam());

        Submission submission = evaluation.getSubmission();
        submission.setStatus(SubmissionStatus.PROCESSING);
        submissionRepository.save(submission);

        // Clear previous AI result
        evaluation.setAiMarks(null);
        evaluation.setAiConfidence(null);
        evaluation.setAiFeedbackJson(null);
        evaluationRepository.save(evaluation);

        aiEngineService.evaluate(
                submission,
                resultJson -> handleAiResult(evaluation.getId(), resultJson),
                error -> log.error("Re-evaluation failed for evaluation {}: {}",
                        evaluationId, error.getMessage())
        );
    }

    @Transactional(readOnly = true)
    public List<EvaluationResponse> getPendingReviewQueue(UUID examId) {
        return evaluationRepository.findUnreviewedByExamId(examId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── AI result handler ─────────────────────────────────────────────────────

    /**
     * Parses the AI JSON payload using Jackson and persists results.
     * Expected JSON from FastAPI:
     * {
     *   "ai_marks": 18.5,
     *   "ai_confidence": 0.87,
     *   "feedback": {
     *     "covered_keywords": [...],
     *     "missing_keywords": [...],
     *     "missing_sentences": [...],
     *     "semantic_score": 0.81,
     *     "keyword_score": 0.70,
     *     "sentence_score": 0.75,
     *     "length_score": 0.90
     *   }
     * }
     */
    @Transactional
    public void handleAiResult(UUID evaluationId, String resultJson) {
        Evaluation evaluation = findById(evaluationId);

        try {
            JsonNode root = objectMapper.readTree(resultJson);

            double aiMarks      = root.path("ai_marks").asDouble(0.0);
            double aiConfidence = root.path("ai_confidence").asDouble(0.0);

            // Clamp marks to total marks ceiling
            double totalMarks = evaluation.getSubmission().getExam().getTotalMarks();
            aiMarks = Math.min(aiMarks, totalMarks);

            evaluation.setAiMarks(aiMarks);
            evaluation.setAiConfidence(aiConfidence);
            evaluation.setAiFeedbackJson(resultJson); // store full JSON for frontend
            evaluationRepository.save(evaluation);

            Submission submission = evaluation.getSubmission();
            submission.setStatus(SubmissionStatus.AI_EVALUATED);
            submissionRepository.save(submission);

            log.info("AI result saved for evaluation {} — marks: {}, confidence: {}",
                    evaluationId, aiMarks, aiConfidence);

        } catch (Exception e) {
            log.error("Failed to parse AI result for evaluation {}: {}", evaluationId, e.getMessage());
            // Don't crash — revert submission status so teacher knows something went wrong
            Submission submission = evaluation.getSubmission();
            submission.setStatus(SubmissionStatus.PENDING);
            submissionRepository.save(submission);
        }
    }

    /**
     * Creates a new Evaluation record and triggers AI asynchronously.
     * Called by SubmissionService after file is stored.
     */
    @Transactional
    public void initiateEvaluation(Submission submission) {
        Evaluation evaluation = Evaluation.builder()
                .submission(submission)
                .build();
        Evaluation saved = evaluationRepository.save(evaluation);

        submission.setStatus(SubmissionStatus.PROCESSING);
        submissionRepository.save(submission);

        aiEngineService.evaluate(
                submission,
                resultJson -> handleAiResult(saved.getId(), resultJson),
                error -> {
                    submission.setStatus(SubmissionStatus.PENDING);
                    submissionRepository.save(submission);
                    log.error("Initial evaluation failed for submission {}: {}",
                            submission.getId(), error.getMessage());
                }
        );
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Evaluation findById(UUID id) {
        return evaluationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Evaluation not found: " + id));
    }

    private void requireTeacherOwnership(Exam exam) {
        User user = currentUser();
        if (!exam.getClassroom().getTeacher().getId().equals(user.getId())) {
            throw new UnauthorizedActionException("You do not own this exam's classroom");
        }
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }

    private EvaluationResponse toResponse(Evaluation e) {
        Submission s = e.getSubmission();
        return new EvaluationResponse(
                e.getId(),
                s.getId(),
                s.getStudent().getName(),
                s.getExam().getTitle(),
                e.getAiMarks(),
                e.getAiConfidence(),
                e.getAiFeedbackJson(),
                e.getTeacherMarks(),
                e.getTeacherComment(),
                e.getReviewedBy() != null ? e.getReviewedBy().getName() : null,
                e.getReviewedAt(),
                e.getFinalMarks(),
                e.isReviewed()
        );
    }
}
