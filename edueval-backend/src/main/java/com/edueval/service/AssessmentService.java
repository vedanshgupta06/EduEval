package com.edueval.service;

import com.edueval.dto.request.*;
import com.edueval.dto.response.*;
import com.edueval.entity.*;
import com.edueval.enums.QuestionType;
import com.edueval.exception.ResourceNotFoundException;
import com.edueval.exception.UnauthorizedActionException;
import com.edueval.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AssessmentService {

    private final AssessmentRepository assessmentRepository;
    private final AssessmentQuestionRepository questionRepository;
    private final AssessmentSubmissionRepository submissionRepository;
    private final AssessmentAnswerRepository answerRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMemberRepository classroomMemberRepository;
    private final UserRepository userRepository;
    private final AssessmentGradingService gradingService;
    private final ObjectMapper objectMapper;

    // ── Teacher: create assessment ────────────────────────────────────────────

    @Transactional
    public AssessmentResponse createAssessment(UUID classroomId, CreateAssessmentRequest req) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + classroomId));

        requireClassroomOwnership(classroom);

        int totalMarks = req.questions().stream()
                .mapToInt(AssessmentQuestionRequest::marks)
                .sum();

        Assessment assessment = Assessment.builder()
                .classroom(classroom)
                .title(req.title())
                .description(req.description())
                .totalMarks(totalMarks)
                .deadline(req.deadline())
                .durationMinutes(req.durationMinutes())
                .build();

        assessmentRepository.save(assessment);

        // Save questions
        List<AssessmentQuestion> questions = new ArrayList<>();
        for (int i = 0; i < req.questions().size(); i++) {
            AssessmentQuestionRequest qr = req.questions().get(i);
            QuestionType type = QuestionType.valueOf(qr.questionType().toUpperCase());

            AssessmentQuestion q = AssessmentQuestion.builder()
                    .assessment(assessment)
                    .questionNo(i + 1)
                    .questionText(qr.questionText())
                    .questionType(type)
                    .marks(qr.marks())
                    .options(toJson(qr.options()))
                    .correctAnswers(toJson(qr.correctAnswers()))
                    .modelAnswerText(qr.modelAnswerText())
                    .scoringMode(qr.scoringMode() != null ? qr.scoringMode() : "PROPORTIONAL")
                    .build();

            questions.add(q);
        }
        questionRepository.saveAll(questions);
        assessment.setQuestions(questions);

        return toResponse(assessment, true); // true = include correctAnswers (teacher view)
    }

    // ── Get assessment (teacher gets correct answers, student doesn't) ────────

    public AssessmentResponse getAssessment(UUID assessmentId, boolean includeAnswers) {
        Assessment assessment = findById(assessmentId);
        return toResponse(assessment, includeAnswers);
    }

    public List<AssessmentResponse> getAssessmentsForClassroom(UUID classroomId) {
        List<Assessment> list = assessmentRepository.findByClassroomId(classroomId);
        return list.stream()
                .map(a -> toResponse(a, false))
                .collect(Collectors.toList());
    }

    // ── Student: submit answers ───────────────────────────────────────────────

    @Transactional
    public AssessmentSubmissionResponse submitAssessment(UUID assessmentId, SubmitAssessmentRequest req) {
        User student = currentUser();
        Assessment assessment = findById(assessmentId);

        // Validate membership
        boolean isMember = classroomMemberRepository
                .existsByClassroomAndStudent(assessment.getClassroom(), student);
        if (!isMember) {
            throw new UnauthorizedActionException("You are not enrolled in this classroom");
        }

        // Validate deadline
        if (assessment.getDeadline().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("The submission deadline has passed");
        }

        // Prevent duplicate submission
        if (submissionRepository.existsByStudentAndAssessment(student, assessment)) {
            throw new IllegalArgumentException("You have already submitted this assessment");
        }

        // Build submission
        AssessmentSubmission submission = AssessmentSubmission.builder()
                .student(student)
                .assessment(assessment)
                .status("PENDING")
                .build();
        submissionRepository.save(submission);

        // Build a map of questionId → question for fast lookup
        Map<UUID, AssessmentQuestion> questionMap = assessment.getQuestions().stream()
                .collect(Collectors.toMap(AssessmentQuestion::getId, q -> q));

        // Create answer entities
        List<AssessmentAnswer> answers = new ArrayList<>();
        for (AnswerRequest ar : req.answers()) {
            AssessmentQuestion question = questionMap.get(ar.questionId());
            if (question == null) {
                log.warn("Unknown question ID {} in submission, skipping", ar.questionId());
                continue;
            }
            AssessmentAnswer answer = AssessmentAnswer.builder()
                    .submission(submission)
                    .question(question)
                    .answerValue(ar.answerValue())
                    .build();
            answers.add(answer);
        }
        answerRepository.saveAll(answers);
        submission.setAnswers(answers);

        // Grade
        AssessmentSubmission graded = gradingService.gradeSubmission(submission);
        submissionRepository.save(graded);

        return toSubmissionResponse(graded);
    }

    // ── Teacher: view all results ─────────────────────────────────────────────

    public List<AssessmentSubmissionResponse> getResults(UUID assessmentId) {
        Assessment assessment = findById(assessmentId);
        requireClassroomOwnership(assessment.getClassroom());

        return submissionRepository.findByAssessmentIdWithAnswers(assessmentId)
                .stream()
                .map(this::toSubmissionResponse)
                .collect(Collectors.toList());
    }

    // ── Teacher: override descriptive answer marks ────────────────────────────

    @Transactional
    public AssessmentAnswerResponse overrideAnswerMarks(UUID assessmentId,
                                                        TeacherAssessmentOverrideRequest req) {
        AssessmentAnswer answer = answerRepository.findById(req.answerId())
                .orElseThrow(() -> new ResourceNotFoundException("Answer not found: " + req.answerId()));

        Assessment assessment = answer.getSubmission().getAssessment();
        requireClassroomOwnership(assessment.getClassroom());

        answer.setTeacherMarks(req.marks());
        answer.setTeacherComment(req.comment());
        answerRepository.save(answer);

        // Recalculate submission total
        AssessmentSubmission submission = answer.getSubmission();
        double total = submission.getAnswers().stream()
                .mapToDouble(a -> a.getFinalMarks() != null ? a.getFinalMarks() : 0.0)
                .sum();
        submission.setTotalMarksObtained(total);
        submission.setStatus("GRADED");
        submissionRepository.save(submission);

        return toAnswerResponse(answer);
    }

    // ── Student: get own submission ───────────────────────────────────────────

    public AssessmentSubmissionResponse getMySubmission(UUID assessmentId) {
        User student = currentUser();
        Assessment assessment = findById(assessmentId);
        AssessmentSubmission submission = submissionRepository
                .findByStudentAndAssessment(student, assessment)
                .orElseThrow(() -> new ResourceNotFoundException("No submission found"));
        return toSubmissionResponse(submission);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public Assessment findById(UUID id) {
        return assessmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment not found: " + id));
    }

    private void requireClassroomOwnership(Classroom classroom) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        User teacher = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!classroom.getTeacher().getId().equals(teacher.getId())) {
            throw new UnauthorizedActionException("You do not own this classroom");
        }
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private String toJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return null;
        }
    }

    private List<String> fromJsonStringList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, String.class));
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<Integer> fromJsonIntList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, Integer.class));
        } catch (Exception e) {
            return List.of();
        }
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private AssessmentResponse toResponse(Assessment a, boolean includeCorrectAnswers) {
        List<AssessmentQuestionResponse> qrs = a.getQuestions().stream()
                .map(q -> new AssessmentQuestionResponse(
                        q.getId(),
                        q.getQuestionNo(),
                        q.getQuestionText(),
                        q.getQuestionType().name(),
                        q.getMarks(),
                        fromJsonStringList(q.getOptions()),
                        includeCorrectAnswers ? fromJsonIntList(q.getCorrectAnswers()) : null,
                        q.getScoringMode()
                ))
                .collect(Collectors.toList());

        return new AssessmentResponse(
                a.getId(), a.getTitle(), a.getDescription(),
                a.getTotalMarks(), a.getDeadline(), a.getDurationMinutes(),
                qrs, a.getCreatedAt()
        );
    }

    AssessmentSubmissionResponse toSubmissionResponse(AssessmentSubmission s) {
        List<AssessmentAnswerResponse> answers = s.getAnswers().stream()
                .map(this::toAnswerResponse)
                .collect(Collectors.toList());

        return new AssessmentSubmissionResponse(
                s.getId(),
                s.getAssessment().getId(),
                s.getStudent().getName(),
                s.getStudent().getEmail(),
                s.getTotalMarksObtained(),
                s.getAssessment().getTotalMarks(),
                s.getStatus(),
                answers,
                s.getSubmittedAt()
        );
    }

    private AssessmentAnswerResponse toAnswerResponse(AssessmentAnswer a) {
        AssessmentQuestion q = a.getQuestion();
        return new AssessmentAnswerResponse(
                a.getId(),
                q.getId(),
                q.getQuestionNo(),
                q.getQuestionText(),
                q.getQuestionType().name(),
                q.getMarks(),
                a.getAnswerValue(),
                a.getMarksObtained(),
                a.getTeacherMarks(),
                a.getTeacherComment(),
                a.getFinalMarks(),
                a.getAiFeedbackJson(),
                a.getAiConfidence()
        );
    }
}
