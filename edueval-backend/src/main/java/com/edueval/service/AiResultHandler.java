package com.edueval.service;

import com.edueval.entity.Evaluation;
import com.edueval.entity.Submission;
import com.edueval.enums.SubmissionStatus;
import com.edueval.exception.ResourceNotFoundException;
import com.edueval.repository.EvaluationRepository;
import com.edueval.repository.SubmissionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiResultHandler {

    private final EvaluationRepository evaluationRepository;
    private final SubmissionRepository submissionRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public void handleAiResult(UUID evaluationId, String resultJson) {
        Evaluation evaluation = evaluationRepository.findById(evaluationId)
                .orElseThrow(() -> new ResourceNotFoundException("Evaluation not found: " + evaluationId));

        try {
            JsonNode root = objectMapper.readTree(resultJson);

            double aiMarks      = root.path("ai_marks").asDouble(0.0);
            double aiConfidence = root.path("ai_confidence").asDouble(0.0);

            double totalMarks = evaluation.getSubmission().getExam().getTotalMarks();
            aiMarks = Math.min(aiMarks, totalMarks);

            evaluation.setAiMarks(aiMarks);
            evaluation.setAiConfidence(aiConfidence);
            evaluation.setAiFeedbackJson(resultJson);
            evaluationRepository.save(evaluation);

            Submission submission = evaluation.getSubmission();
            submission.setStatus(SubmissionStatus.AI_EVALUATED);
            submissionRepository.save(submission);

            log.info("AI result saved for evaluation {} — marks: {}, confidence: {}",
                    evaluationId, aiMarks, aiConfidence);

        } catch (Exception e) {
            log.error("Failed to parse AI result for evaluation {}: {}", evaluationId, e.getMessage());
            Submission submission = evaluation.getSubmission();
            submission.setStatus(SubmissionStatus.PENDING);
            submissionRepository.save(submission);
        }
    }
}