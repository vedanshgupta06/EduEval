package com.edueval.repository;

import com.edueval.entity.Evaluation;
import com.edueval.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EvaluationRepository extends JpaRepository<Evaluation, UUID> {

    Optional<Evaluation> findBySubmission(Submission submission);

    Optional<Evaluation> findBySubmissionId(UUID submissionId);

    // All evaluations for an exam — used for analytics
    @Query("""
        SELECT e FROM Evaluation e
        JOIN e.submission s
        WHERE s.exam.id = :examId
    """)
    List<Evaluation> findByExamId(UUID examId);

    // EvaluationRepository.java — add this method
    @Query("SELECT e FROM Evaluation e " +
            "JOIN FETCH e.submission s " +
            "JOIN FETCH s.exam ex " +
            "JOIN FETCH s.student " +
            "WHERE s.status = 'PENDING'")
    List<Evaluation> findPendingEvaluations();

    // Pending teacher review
    @Query("""
        SELECT e FROM Evaluation e
        JOIN e.submission s
        WHERE s.exam.id = :examId
        AND e.teacherMarks IS NULL
    """)
    List<Evaluation> findUnreviewedByExamId(UUID examId);
}