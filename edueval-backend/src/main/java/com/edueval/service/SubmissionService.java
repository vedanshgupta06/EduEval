package com.edueval.service;

import com.edueval.dto.response.SubmissionResponse;
import com.edueval.entity.Exam;
import com.edueval.entity.Submission;
import com.edueval.entity.User;
import com.edueval.enums.SubmissionStatus;
import com.edueval.exception.ResourceNotFoundException;
import com.edueval.exception.UnauthorizedActionException;
import com.edueval.repository.ClassroomMemberRepository;
import com.edueval.repository.SubmissionRepository;
import com.edueval.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SubmissionService {

    private final SubmissionRepository submissionRepository;
    private final ClassroomMemberRepository classroomMemberRepository;  // FIX: membership check
    private final ExamService examService;
    private final FileStorageService fileStorageService;
    private final UserRepository userRepository;
    private final ApplicationContext applicationContext;

    // ── Student ──────────────────────────────────────────────────────────────

    @Transactional
    public SubmissionResponse submitAnswerSheet(UUID examId, MultipartFile file) {
        User student = currentUser();
        Exam exam = examService.findById(examId);

        // FIX 1: Verify student is enrolled in the classroom
        boolean isMember = classroomMemberRepository
                .existsByClassroomAndStudent(exam.getClassroom(), student);
        if (!isMember) {
            throw new UnauthorizedActionException(
                    "You are not enrolled in this exam's classroom");
        }

        // FIX 2: Enforce submission deadline at API level
        if (exam.getDeadline().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException(
                    "The submission deadline for this exam has passed");
        }

        // FIX 3: Prevent duplicate submissions
        if (submissionRepository.existsByStudentAndExam(student, exam)) {
            throw new IllegalArgumentException(
                    "You have already submitted for this exam. " +
                            "Ask your teacher to allow a resubmission.");
        }

        String fileUrl = fileStorageService.store(file, "submissions/" + examId);

        Submission submission = Submission.builder()
                .student(student)
                .exam(exam)
                .fileUrl(fileUrl)
                .status(SubmissionStatus.PENDING)
                .build();

        Submission saved = submissionRepository.save(submission);

        // Trigger AI evaluation asynchronously
        applicationContext.getBean(EvaluationService.class).initiateEvaluation(saved);

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<SubmissionResponse> getStudentSubmissions() {
        User student = currentUser();
        return submissionRepository.findByStudent(student)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── Teacher ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SubmissionResponse> getSubmissionsForExam(UUID examId) {
        Exam exam = examService.findById(examId);
        requireTeacherOwnership(exam);
        return submissionRepository.findByExam(exam)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public SubmissionResponse updateSubmissionStatus(UUID submissionId, SubmissionStatus newStatus) {
        Submission submission = findById(submissionId);
        requireTeacherOwnership(submission.getExam());
        submission.setStatus(newStatus);
        return toResponse(submissionRepository.save(submission));
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public SubmissionResponse getSubmissionById(UUID submissionId) {
        return toResponse(findById(submissionId));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    public Submission findById(UUID id) {
        return submissionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Submission not found: " + id));
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

    private SubmissionResponse toResponse(Submission s) {
        return new SubmissionResponse(
                s.getId(),
                s.getExam().getId(),
                s.getExam().getTitle(),
                s.getStudent().getId(),
                s.getStudent().getName(),
                s.getFileUrl(),
                s.getStatus(),
                s.getSubmittedAt()
        );
    }
}
