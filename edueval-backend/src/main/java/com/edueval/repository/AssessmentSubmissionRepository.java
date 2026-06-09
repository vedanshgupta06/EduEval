package com.edueval.repository;

import com.edueval.entity.Assessment;
import com.edueval.entity.AssessmentSubmission;
import com.edueval.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AssessmentSubmissionRepository extends JpaRepository<AssessmentSubmission, UUID> {

    boolean existsByStudentAndAssessment(User student, Assessment assessment);

    Optional<AssessmentSubmission> findByStudentAndAssessment(User student, Assessment assessment);

    List<AssessmentSubmission> findByAssessment(Assessment assessment);

    @Query("SELECT s FROM AssessmentSubmission s LEFT JOIN FETCH s.answers WHERE s.id = :id")
    Optional<AssessmentSubmission> findByIdWithAnswers(@Param("id") UUID id);

    @Query("SELECT s FROM AssessmentSubmission s LEFT JOIN FETCH s.answers WHERE s.assessment.id = :assessmentId")
    List<AssessmentSubmission> findByAssessmentIdWithAnswers(@Param("assessmentId") UUID assessmentId);
}
