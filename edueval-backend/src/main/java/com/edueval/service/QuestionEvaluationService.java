package com.edueval.service;

import com.edueval.dto.response.QuestionEvaluationResponse;
import com.edueval.dto.request.QuestionOverrideRequest;
import com.edueval.entity.*;
import com.edueval.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class QuestionEvaluationService {

    private final QuestionEvaluationRepository questionEvaluationRepository;
    private final QuestionSubmissionRepository questionSubmissionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    // ── Teacher override per question ──────────────────────────────────────────

    @Transactional
    public QuestionEvaluationResponse overrideQuestion(UUID questionSubmissionId,
                                                        QuestionOverrideRequest req,
                                                        UUID teacherId) {

        QuestionEvaluation eval = questionEvaluationRepository
                .findByQuestionSubmissionId(questionSubmissionId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "No evaluation found for QuestionSubmission " + questionSubmissionId));

        User teacher = userRepository.findById(teacherId)
                .orElseThrow(() -> new EntityNotFoundException("Teacher not found"));

        eval.setTeacherMarks(req.getTeacherMarks());
        eval.setTeacherComment(req.getTeacherComment());
        eval.setReviewedBy(teacher);
        eval.setReviewedAt(LocalDateTime.now());
        questionEvaluationRepository.save(eval);

        // Mark question submission as REVIEWED
        QuestionSubmission qs = eval.getQuestionSubmission();
        qs.setStatus("REVIEWED");
        questionSubmissionRepository.save(qs);

        return toResponse(eval);
    }

    // ── Get all question evaluations for a submission ─────────────────────────

    public List<QuestionEvaluationResponse> getForSubmission(UUID submissionId) {
        return questionEvaluationRepository
                .findByQuestionSubmissionSubmissionId(submissionId)
                .stream()
                .map(this::toResponse)
                .sorted(Comparator.comparing(r -> r.getQuestionNo()))
                .toList();
    }

    // ── Aggregate totals (used by parent submission/evaluation endpoint) ───────

    public record AggregatedScore(double aiTotal, double teacherTotal, double effectiveTotal,
                                   int questionCount) {}

    public AggregatedScore aggregate(UUID submissionId) {
        List<QuestionEvaluationResponse> list = getForSubmission(submissionId);
        double ai = list.stream().mapToDouble(r -> r.getAiMarks() != null ? r.getAiMarks() : 0).sum();
        double teacher = list.stream().mapToDouble(r -> r.getTeacherMarks() != null ? r.getTeacherMarks() : 0).sum();
        double effective = list.stream().mapToDouble(r -> r.getEffectiveMarks() != null ? r.getEffectiveMarks() : 0).sum();
        return new AggregatedScore(ai, teacher, effective, list.size());
    }

    // ── Mapping ────────────────────────────────────────────────────────────────

    private QuestionEvaluationResponse toResponse(QuestionEvaluation eval) {
        QuestionSubmission qs = eval.getQuestionSubmission();
        ExamQuestion q = qs.getQuestion();

        QuestionEvaluationResponse r = new QuestionEvaluationResponse();
        r.setQuestionSubmissionId(qs.getId());
        r.setQuestionNo(q.getQuestionNo());
        r.setQuestionText(q.getQuestionText());
        r.setMaxMarks(q.getMarks());
        r.setAiMarks(eval.getAiMarks());
        r.setAiConfidence(eval.getAiConfidence());
        r.setStatus(qs.getStatus());

        // Parse JSON feedback
        try {
            if (eval.getAiFeedbackJson() != null) {
                r.setAiFeedback(objectMapper.readValue(eval.getAiFeedbackJson(), Object.class));
            }
        } catch (Exception ignored) {
            r.setAiFeedback(eval.getAiFeedbackJson());
        }

        r.setTeacherMarks(eval.getTeacherMarks());
        r.setTeacherComment(eval.getTeacherComment());
        r.setEffectiveMarks(eval.getTeacherMarks() != null ? eval.getTeacherMarks() : eval.getAiMarks());
        r.setFileUrl(qs.getFileUrl());
        return r;
    }
}