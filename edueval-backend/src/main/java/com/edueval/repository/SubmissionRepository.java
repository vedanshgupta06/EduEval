package com.edueval.repository;

import com.edueval.entity.Exam;
import com.edueval.entity.Submission;
import com.edueval.entity.User;
import com.edueval.enums.SubmissionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubmissionRepository extends JpaRepository<Submission, UUID> {

    Optional<Submission> findByStudentAndExam(User student, Exam exam);

    boolean existsByStudentAndExam(User student, Exam exam);

    // All submissions for a given exam (teacher view)
    List<Submission> findByExam(Exam exam);

    // All submissions by a student across all exams
    List<Submission> findByStudent(User student);

    // Submissions pending teacher review for a given exam
    List<Submission> findByExamAndStatus(Exam exam, SubmissionStatus status);

    // Count submissions per exam (for analytics)
    long countByExam(Exam exam);
}