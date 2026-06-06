package com.edueval.service;

import com.edueval.dto.request.CreateExamRequest;
import com.edueval.dto.request.UpdateExamRequest;
import com.edueval.dto.response.ExamResponse;
import com.edueval.dto.response.QuestionResponse;
import com.edueval.entity.Classroom;
import com.edueval.entity.Evaluation;
import com.edueval.entity.Exam;
import com.edueval.entity.Submission;
import com.edueval.entity.User;
import com.edueval.enums.SubmissionStatus;
import com.edueval.exception.ResourceNotFoundException;
import com.edueval.exception.UnauthorizedActionException;
import com.edueval.repository.ClassroomRepository;
import com.edueval.repository.EvaluationRepository;
import com.edueval.repository.ExamRepository;
import com.edueval.repository.SubmissionRepository;
import com.edueval.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final ClassroomRepository classroomRepository;
    private final SubmissionRepository submissionRepository;
    private final EvaluationRepository evaluationRepository;
    private final UserRepository userRepository;
    private final ExamQuestionService examQuestionService;

    // ── Teacher ──────────────────────────────────────────────────────────────

    @Transactional
    public ExamResponse createExam(UUID classroomId, CreateExamRequest request) {
        Classroom classroom = findClassroom(classroomId);
        requireClassroomOwnership(classroom);

        boolean isMulti = Boolean.TRUE.equals(request.isMultiQuestion())
                && request.questions() != null
                && !request.questions().isEmpty();

        // Auto-sum marks from questions; fall back to explicit totalMarks for single mode
        int totalMarks = isMulti
                ? request.questions().stream().mapToInt(q -> q.getMarks()).sum()
                : (request.totalMarks() != null ? request.totalMarks() : 0);

        Exam exam = Exam.builder()
                .classroom(classroom)
                .title(request.title())
                .totalMarks(totalMarks)
                .deadline(request.deadline())
                .modelAnswerUrl(request.modelAnswerUrl())
                .modelAnswerText(request.modelAnswerText())
                .isMultiQuestion(isMulti)
                .build();

        examRepository.save(exam);

        if (isMulti) {
            examQuestionService.saveQuestionsForExam(exam, request.questions());
        }

        return toResponse(exam);
    }

    @Transactional
    public ExamResponse updateExam(UUID examId, UpdateExamRequest request) {
        Exam exam = findById(examId);
        requireClassroomOwnership(exam.getClassroom());

        if (request.title()           != null) exam.setTitle(request.title());
        if (request.totalMarks()      != null) exam.setTotalMarks(request.totalMarks());
        if (request.deadline()        != null) exam.setDeadline(request.deadline());
        if (request.modelAnswerUrl()  != null) exam.setModelAnswerUrl(request.modelAnswerUrl());
        if (request.modelAnswerText() != null) exam.setModelAnswerText(request.modelAnswerText());

        return toResponse(examRepository.save(exam));
    }

    @Transactional
    public void deleteExam(UUID examId) {
        Exam exam = findById(examId);
        requireClassroomOwnership(exam.getClassroom());
        List<Evaluation> evaluations = evaluationRepository.findByExamId(examId);
        List<Submission> submissions = submissionRepository.findByExam(exam);
        evaluationRepository.deleteAll(evaluations);
        submissionRepository.deleteAll(submissions);
        examRepository.delete(exam);
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ExamResponse> getExamsForClassroom(UUID classroomId) {
        Classroom classroom = findClassroom(classroomId);
        return examRepository.findByClassroomOrderByDeadlineAsc(classroom)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ExamResponse getExamById(UUID examId) {
        Exam exam = findById(examId);
        ExamResponse response = toResponse(exam);

        // Attach questions list for multi-question exams
        if (Boolean.TRUE.equals(exam.getIsMultiQuestion())) {
            List<QuestionResponse> questions = examQuestionService
                    .getQuestionsForExam(examId)
                    .stream()
                    .map(examQuestionService::toResponse)
                    .toList();
            response.setQuestions(questions);
        }

        return response;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    public Exam findById(UUID id) {
        return examRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found: " + id));
    }

    private Classroom findClassroom(UUID id) {
        return classroomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
    }

    private void requireClassroomOwnership(Classroom classroom) {
        User user = currentUser();
        if (!classroom.getTeacher().getId().equals(user.getId())) {
            throw new UnauthorizedActionException("You do not own this classroom");
        }
    }

    User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }

    private ExamResponse toResponse(Exam e) {
        long submissionCount = submissionRepository.countByExam(e);
        return new ExamResponse(
                e.getId(),
                e.getTitle(),
                e.getTotalMarks(),
                e.getDeadline(),
                e.getModelAnswerUrl(),
                e.getModelAnswerText(),
                e.getClassroom().getId(),
                e.getClassroom().getClassName(),
                e.getClassroom().getTeacher().getName(),
                submissionCount,
                e.getCreatedAt(),
                e.getIsMultiQuestion()
        );
    }
}