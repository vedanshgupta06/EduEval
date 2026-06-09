package com.edueval.service;

import com.edueval.entity.AssessmentAnswer;
import com.edueval.entity.AssessmentQuestion;
import com.edueval.entity.AssessmentSubmission;
import com.edueval.enums.QuestionType;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Grades all answers in an AssessmentSubmission.
 *
 * MCQ / MULTI_SELECT → instant, synchronous, no AI.
 * DESCRIPTIVE        → async call to FastAPI /evaluate-text endpoint.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssessmentGradingService {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${app.ai-engine.base-url:http://127.0.0.1:8000}")
    private String aiBaseUrl;

    // ── Public entry point ────────────────────────────────────────────────────

    /**
     * Grades all answers synchronously (MCQ/multi-select) and
     * fires async AI calls for descriptive answers.
     * Returns updated submission with totalMarksObtained set.
     */
    @Transactional
    public AssessmentSubmission gradeSubmission(AssessmentSubmission submission) {
        double total = 0.0;
        boolean hasDescriptive = false;

        for (AssessmentAnswer answer : submission.getAnswers()) {
            AssessmentQuestion q = answer.getQuestion();

            if (q.getQuestionType() == QuestionType.MCQ) {
                double marks = gradeMcq(answer, q);
                answer.setMarksObtained(marks);
                total += marks;

            } else if (q.getQuestionType() == QuestionType.MULTI_SELECT) {
                double marks = gradeMultiSelect(answer, q);
                answer.setMarksObtained(marks);
                total += marks;

            } else {
                // DESCRIPTIVE — AI graded asynchronously
                hasDescriptive = true;
                answer.setMarksObtained(0.0); // placeholder until AI responds
                gradeDescriptiveAsync(answer, q, submission.getId());
            }
        }

        submission.setTotalMarksObtained(total);
        submission.setStatus(hasDescriptive ? "PARTIALLY_GRADED" : "GRADED");
        return submission;
    }

    // ── MCQ grading ──────────────────────────────────────────────────────────

    private double gradeMcq(AssessmentAnswer answer, AssessmentQuestion question) {
        try {
            List<Integer> chosen = parseIntList(answer.getAnswerValue());
            List<Integer> correct = parseIntList(question.getCorrectAnswers());
            if (chosen.size() == 1 && correct.size() == 1
                    && chosen.get(0).equals(correct.get(0))) {
                return question.getMarks();
            }
        } catch (Exception e) {
            log.warn("Failed to parse MCQ answer for question {}: {}", question.getId(), e.getMessage());
        }
        return 0.0;
    }

    // ── Multi-select grading ─────────────────────────────────────────────────

    private double gradeMultiSelect(AssessmentAnswer answer, AssessmentQuestion question) {
        try {
            Set<Integer> chosen = new HashSet<>(parseIntList(answer.getAnswerValue()));
            Set<Integer> correct = new HashSet<>(parseIntList(question.getCorrectAnswers()));

            boolean isStrict = "STRICT".equalsIgnoreCase(question.getScoringMode());

            if (isStrict) {
                return chosen.equals(correct) ? question.getMarks() : 0.0;
            }

            // PROPORTIONAL: credit for each correct selection, penalise wrong ones
            long correctHits = chosen.stream().filter(correct::contains).count();
            long wrongHits   = chosen.stream().filter(c -> !correct.contains(c)).count();

            double score = (double) correctHits / correct.size()
                         - (double) wrongHits / correct.size();
            score = Math.max(0.0, score);
            return Math.round(score * question.getMarks() * 100.0) / 100.0;

        } catch (Exception e) {
            log.warn("Failed to parse MULTI_SELECT answer for question {}: {}", question.getId(), e.getMessage());
        }
        return 0.0;
    }

    // ── Descriptive grading (async AI call) ──────────────────────────────────

    @Async
    public void gradeDescriptiveAsync(AssessmentAnswer answer,
                                      AssessmentQuestion question,
                                      UUID submissionId) {
        log.info("Sending descriptive answer {} to AI engine", answer.getId());

        Map<String, Object> payload = new HashMap<>();
        payload.put("answer_text",        answer.getAnswerValue() != null ? answer.getAnswerValue() : "");
        payload.put("model_answer_text",  question.getModelAnswerText() != null ? question.getModelAnswerText() : "");
        payload.put("max_marks",          question.getMarks());
        payload.put("question_text",      question.getQuestionText());
        payload.put("answer_id",          answer.getId().toString());
        payload.put("submission_id",      submissionId.toString());

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

            String result = restTemplate.postForObject(
                    aiBaseUrl + "/evaluate-text",
                    request,
                    String.class
            );
            log.info("AI text evaluation complete for answer {}", answer.getId());
            // Result is handled by AssessmentAiResultHandler (see below)
        } catch (Exception e) {
            log.error("AI text evaluation failed for answer {}: {}", answer.getId(), e.getMessage());
            // Fallback: mark as 0 with error note
            answer.setMarksObtained(0.0);
            answer.setAiFeedbackJson("{\"error\": \"AI evaluation failed. Please review manually.\"}");
            answer.setAiConfidence(0.0);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<Integer> parseIntList(String json) throws Exception {
        if (json == null || json.isBlank()) return List.of();
        return objectMapper.readValue(json, new TypeReference<List<Integer>>() {});
    }
}
