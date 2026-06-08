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
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

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
    private final FileStorageService fileStorageService;
    private final ObjectMapper objectMapper;

    @Value("${app.file-storage.upload-dir:./uploads}")
    private String uploadDir;

    @Value("${app.ai-engine.base-url:http://localhost:8000}")
    private String aiBaseUrl;

    // ── 1. Student uploads file for one question ──────────────────────────────

    @Transactional
    public QuestionSubmission uploadQuestionFile(UUID submissionId,
                                                 UUID questionId,
                                                 MultipartFile file) {

        Submission submission = requireStudentSubmission(submissionId);
        ExamQuestion question = examQuestionRepository.findById(questionId)
                .orElseThrow(() -> new EntityNotFoundException("Question not found"));

        UUID examId = submission.getExam().getId();
        if (!question.getExam().getId().equals(examId)) {
            throw new IllegalArgumentException("Question does not belong to this exam");
        }

        String fileUrl = fileStorageService.store(file, "submissions/" + examId);
        return upsertQuestionSubmission(submission, question, fileUrl);
    }

    @Transactional
    public List<QuestionSubmission> uploadAnswerSheetForAllQuestions(UUID submissionId,
                                                                     MultipartFile file) {
        Submission submission = requireStudentSubmission(submissionId);
        UUID examId = submission.getExam().getId();
        String fileUrl = fileStorageService.store(file, "submissions/" + examId);

        submission.setFileUrl(fileUrl);
        submission.setStatus(SubmissionStatus.PENDING);
        submissionRepository.save(submission);

        List<ExamQuestion> questions = examQuestionRepository.findByExamIdOrderByQuestionNoAsc(examId);
        if (questions.isEmpty()) {
            throw new IllegalArgumentException("No questions found for this exam");
        }

        List<QuestionSubmission> saved = new ArrayList<>();
        for (ExamQuestion question : questions) {
            saved.add(upsertQuestionSubmission(submission, question, fileUrl));
        }
        return saved;
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
            body.put("question_no", qs.getQuestion().getQuestionNo());

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

    private Submission requireStudentSubmission(UUID submissionId) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new EntityNotFoundException("Submission not found"));

        User student = currentUser();
        if (!submission.getStudent().getId().equals(student.getId())) {
            throw new IllegalArgumentException("You can only upload files for your own submission");
        }
        return submission;
    }

    private QuestionSubmission upsertQuestionSubmission(
            Submission submission,
            ExamQuestion question,
            String fileUrl) {
        QuestionSubmission qs = questionSubmissionRepository
                .findBySubmissionIdAndQuestionId(submission.getId(), question.getId())
                .orElse(QuestionSubmission.builder()
                        .submission(submission)
                        .question(question)
                        .build());

        qs.setFileUrl(fileUrl);
        qs.setStatus("PENDING");
        return questionSubmissionRepository.save(qs);
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new EntityNotFoundException("Authenticated user not found"));
    }
}
