package com.edueval.repository;

import com.edueval.entity.QuestionEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface QuestionEvaluationRepository extends JpaRepository<QuestionEvaluation, UUID> {

    Optional<QuestionEvaluation> findByQuestionSubmissionId(UUID questionSubmissionId);

    // All evaluations for a top-level submission (join through question_submissions)
    List<QuestionEvaluation> findByQuestionSubmissionSubmissionId(UUID submissionId);
}