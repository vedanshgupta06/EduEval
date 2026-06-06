package com.edueval.service;

import com.edueval.entity.*;
import com.edueval.enums.SubmissionStatus;
import com.edueval.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionSubmissionService {

    private final QuestionSubmissionRepository questionSubmissionRepository;
    private final QuestionEvaluationRepository questionEvaluationRepository;
    private final ExamQuestionRepository examQuestionRepository;
    private final SubmissionRepository submissionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.file-storage.upload-dir:./uploads}")
    private String uploadDir;

    @Value("${app.ai-engine.base-url:http://localhost:8000}")
    private String aiBaseUrl;

    // ── 1. Student uploads file for one question ──────────────────────────────

    @Transactional
public QuestionSubmission uploadQuestionFile(UUID submissionId,
                                              UUID questionId,
                                              MultipartFile file) throws IOException {

    Submission submission = submissionRepository.findById(submissionId)
            .orElseThrow(() -> new EntityNotFoundException("Submission not found"));

    ExamQuestion question = examQuestionRepository.findById(questionId)
            .orElseThrow(() -> new EntityNotFoundException("Question not found"));

    UUID examId = submission.getExam().getId();
    String filename = UUID.randomUUID() + "_q" + question.getQuestionNo()
            + "_" + file.getOriginalFilename();

    // Save to uploads/submissions/{examId}/{filename}
    Path dest = Path.of(uploadDir).resolve("submissions").resolve(examId.toString()).resolve(filename);
    Files.createDirectories(dest.getParent());
    file.transferTo(dest);

    QuestionSubmission qs = questionSubmissionRepository
            .findBySubmissionIdAndQuestionId(submissionId, questionId)
            .orElse(QuestionSubmission.builder()
                    .submission(submission)
                    .question(question)
                    .build());

    // Store relative path so evaluateSingle can reconstruct it
    qs.setFileUrl("submissions/" + examId + "/" + filename);
    qs.setStatus("PENDING");
    return questionSubmissionRepository.save(qs);
}
    // ── 2. Trigger AI evaluation for all uploaded question submissions ─────────

    @Transactional
    public void evaluateAllQuestions(UUID submissionId) {
        List<QuestionSubmission> list = questionSubmissionRepository.findBySubmissionId(submissionId);

        for (QuestionSubmission qs : list) {
            if ("PENDING".equals(qs.getStatus()) || "PROCESSING".equals(qs.getStatus())) {
                evaluateSingle(qs);
            }
        }

        // Refresh list after evaluation
        list = questionSubmissionRepository.findBySubmissionId(submissionId);
        boolean allDone = list.stream()
                .allMatch(q -> "AI_EVALUATED".equals(q.getStatus()) || "REVIEWED".equals(q.getStatus()));

        Submission parent = submissionRepository.findById(submissionId).orElseThrow();
        if (allDone) {
            parent.setStatus(SubmissionStatus.AI_EVALUATED);
            submissionRepository.save(parent);
        }
    }

    // ── 3. Re-evaluate a single question (teacher-triggered) ──────────────────

    @Transactional
    public void reEvaluateSingle(UUID questionSubmissionId) {
        QuestionSubmission qs = questionSubmissionRepository.findById(questionSubmissionId)
                .orElseThrow(() -> new EntityNotFoundException("QuestionSubmission not found"));
        evaluateSingle(qs);
    }

    // ── internal: call FastAPI /evaluate-question ──────────────────────────────

    private void evaluateSingle(QuestionSubmission qs) {
        qs.setStatus("PROCESSING");
        questionSubmissionRepository.save(qs);

        try {
            RestTemplate rt = new RestTemplate();
            Map<String, Object> body = new HashMap<>();
            String fullPath = Path.of(uploadDir)
                .resolve(qs.getFileUrl())
                .toAbsolutePath()
                .toString()
                .replace("\\", "/");
            log.info("Sending file_path to AI: {}", fullPath);
            body.put("file_path", fullPath);
            body.put("model_answer", qs.getQuestion().getModelAnswerText());
            body.put("max_marks", qs.getQuestion().getMarks());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<Map> resp = rt.exchange(
                    aiBaseUrl + "/evaluate-question",
                    HttpMethod.POST,
                    new HttpEntity<>(body, headers),
                    Map.class
            );

            Map<?, ?> result = resp.getBody();
            if (result == null) throw new RuntimeException("Empty AI response");

            // Upsert evaluation
            QuestionEvaluation eval = questionEvaluationRepository
                    .findByQuestionSubmissionId(qs.getId())
                    .orElse(QuestionEvaluation.builder().questionSubmission(qs).build());

            eval.setAiMarks(toDouble(result.get("marks")));
            eval.setAiConfidence(toDouble(result.get("confidence")));
            eval.setAiFeedbackJson(objectMapper.writeValueAsString(result.get("feedback")));

            questionEvaluationRepository.save(eval);
            qs.setStatus("AI_EVALUATED");
            questionSubmissionRepository.save(qs);
            body.put("file_path", uploadDir + "/" + qs.getFileUrl());
log.info("Sending file_path to AI: {}", uploadDir + "/" + qs.getFileUrl()); 
        } catch (Exception e) {
            log.error("AI evaluation failed for QuestionSubmission {}: {}", qs.getId(), e.getMessage());
            qs.setStatus("PENDING");
            questionSubmissionRepository.save(qs);
        }
    }

    private Double toDouble(Object val) {
        if (val == null) return null;
        if (val instanceof Number n) return n.doubleValue();
        return Double.parseDouble(val.toString());
    }

    // ── 4. Fetch all question submissions for a submission ────────────────────

    public List<QuestionSubmission> getForSubmission(UUID submissionId) {
        return questionSubmissionRepository.findBySubmissionId(submissionId);
    }
}