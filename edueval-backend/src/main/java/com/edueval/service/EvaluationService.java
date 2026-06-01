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

        evaluation.setAiMarks(null);
        evaluation.setAiConfidence(null);
        evaluation.setAiFeedbackJson(null);
        evaluationRepository.save(evaluation);

        aiEngineService.evaluate(
                submission,
                evaluation.getId(),
                error -> log.error("Re-evaluation failed for evaluation {}: {}",
                        evaluationId, error.getMessage())
        );
    }

    @Transactional
    public EvaluationResponse triggerEvaluationForSubmission(UUID submissionId) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found: " + submissionId));
        requireTeacherOwnership(submission.getExam());

        Evaluation evaluation = evaluationRepository.findBySubmission(submission)
                .orElseGet(() -> evaluationRepository.save(
                        Evaluation.builder().submission(submission).build()));

        submission.setStatus(SubmissionStatus.PROCESSING);
        submissionRepository.save(submission);

        evaluation.setAiMarks(null);
        evaluation.setAiConfidence(null);
        evaluation.setAiFeedbackJson(null);
        evaluationRepository.save(evaluation);

        UUID evaluationId = evaluation.getId();
        aiEngineService.evaluate(
                submission,
                evaluationId,
                error -> {
                    submission.setStatus(SubmissionStatus.PENDING);
                    submissionRepository.save(submission);
                    log.error("Evaluation retry failed for submission {}: {}",
                            submissionId, error.getMessage());
                }
        );

        return toResponse(evaluation);
    }

    @Transactional(readOnly = true)
    public List<EvaluationResponse> getPendingReviewQueue(UUID examId) {
        return evaluationRepository.findUnreviewedByExamId(examId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── Initiate (called by SubmissionService) ────────────────────────────────

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
                saved.getId(),
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
                s.getExam().getTotalMarks().doubleValue(),
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
    // EvaluationService.java — add this method
    @Transactional
    public void triggerReEvaluationInternal(Evaluation evaluation) {
        Submission submission = evaluation.getSubmission();
        submission.setStatus(SubmissionStatus.PROCESSING);
        submissionRepository.save(submission);

        evaluation.setAiMarks(null);
        evaluation.setAiConfidence(null);
        evaluation.setAiFeedbackJson(null);
        evaluationRepository.save(evaluation);

        aiEngineService.evaluate(
                submission,
                evaluation.getId(),
                error -> log.error("Startup re-evaluation failed for evaluation {}: {}",
                        evaluation.getId(), error.getMessage())
        );
    }
}
