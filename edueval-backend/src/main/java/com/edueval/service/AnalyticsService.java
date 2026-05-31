package com.edueval.service;

import com.edueval.dto.response.ClassroomAnalyticsResponse;
import com.edueval.dto.response.ExamAnalyticsResponse;
import com.edueval.dto.response.StudentProgressResponse;
import com.edueval.entity.*;
import com.edueval.enums.SubmissionStatus;
import com.edueval.exception.ResourceNotFoundException;
import com.edueval.exception.UnauthorizedActionException;
import com.edueval.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final ClassroomRepository classroomRepository;
    private final ClassroomMemberRepository classroomMemberRepository;
    private final ExamRepository examRepository;
    private final SubmissionRepository submissionRepository;
    private final EvaluationRepository evaluationRepository;
    private final UserRepository userRepository;

    // ── Teacher: per-exam analytics ──────────────────────────────────────────

    @Transactional(readOnly = true)
    public ExamAnalyticsResponse getExamAnalytics(UUID examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found: " + examId));
        requireTeacherOwnership(exam.getClassroom());
        return buildExamAnalytics(exam);
    }

    // ── Teacher: classroom-wide analytics ────────────────────────────────────

    @Transactional(readOnly = true)
    public ClassroomAnalyticsResponse getClassroomAnalytics(UUID classroomId) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + classroomId));
        requireTeacherOwnership(classroom);

        List<Exam> exams = examRepository.findByClassroom(classroom);
        List<ExamAnalyticsResponse> examBreakdown = exams.stream()
                .map(this::buildExamAnalytics)
                .collect(Collectors.toList());

        double overallAvg = examBreakdown.stream()
                .filter(e -> e.averageMarks() != null)
                .mapToDouble(ExamAnalyticsResponse::averageMarks)
                .average()
                .orElse(0.0);

        long totalStudents = classroomMemberRepository.countByClassroom(classroom);

        return new ClassroomAnalyticsResponse(
                classroom.getId(),
                classroom.getClassName(),
                totalStudents,
                exams.size(),
                overallAvg,
                examBreakdown
        );
    }

    // ── Student: personal progress ───────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<StudentProgressResponse> getStudentProgress() {
        User student = currentUser();
        List<Submission> submissions = submissionRepository.findByStudent(student);

        return submissions.stream().map(sub -> {
            var evalOpt = evaluationRepository.findBySubmission(sub);

            Double marks = evalOpt.map(Evaluation::getFinalMarks).orElse(null);
            Double percentage = (marks != null)
                    ? (marks / sub.getExam().getTotalMarks()) * 100.0
                    : null;
            boolean reviewed = evalOpt.map(Evaluation::isReviewed).orElse(false);

            return new StudentProgressResponse(
                    sub.getId(),
                    sub.getExam().getId(),
                    sub.getExam().getTitle(),
                    sub.getExam().getClassroom().getClassName(),
                    sub.getExam().getTotalMarks(),
                    marks,
                    percentage,
                    reviewed,
                    sub.getSubmittedAt()
            );
        }).collect(Collectors.toList());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ExamAnalyticsResponse buildExamAnalytics(Exam exam) {
        long totalStudents    = classroomMemberRepository.countByClassroom(exam.getClassroom());
        long submissionCount  = submissionRepository.countByExam(exam);
        double submissionRate = totalStudents > 0
                ? (submissionCount * 100.0 / totalStudents) : 0.0;

        List<Evaluation> evaluations = evaluationRepository.findByExamId(exam.getId());
        List<Double> allFinalMarks = evaluations.stream()
                .map(Evaluation::getFinalMarks)
                .filter(m -> m != null)
                .collect(Collectors.toList());

        Double avg     = allFinalMarks.isEmpty() ? null : allFinalMarks.stream().mapToDouble(d -> d).average().orElse(0);
        Double highest = allFinalMarks.isEmpty() ? null : allFinalMarks.stream().mapToDouble(d -> d).max().orElse(0);
        Double lowest  = allFinalMarks.isEmpty() ? null : allFinalMarks.stream().mapToDouble(d -> d).min().orElse(0);

        long pendingReview = evaluations.stream()
                .filter(e -> e.getTeacherMarks() == null && e.getAiMarks() != null)
                .count();
        long reviewed = evaluations.stream()
                .filter(Evaluation::isReviewed)
                .count();

        return new ExamAnalyticsResponse(
                exam.getId(),
                exam.getTitle(),
                exam.getTotalMarks(),
                totalStudents,
                submissionCount,
                submissionRate,
                avg,
                highest,
                lowest,
                pendingReview,
                reviewed
        );
    }

    private void requireTeacherOwnership(Classroom classroom) {
        User user = currentUser();
        if (!classroom.getTeacher().getId().equals(user.getId())) {
            throw new UnauthorizedActionException("You do not own this classroom");
        }
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }
}
