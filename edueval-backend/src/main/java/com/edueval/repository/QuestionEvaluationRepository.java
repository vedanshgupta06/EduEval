package com.edueval.repository;

import com.edueval.entity.QuestionEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface QuestionEvaluationRepository extends JpaRepository<QuestionEvaluation, UUID> {

    Optional<QuestionEvaluation> findByQuestionSubmissionId(UUID questionSubmissionId);

    // All evaluations for a top-level submission (join through question_submissions)
    List<QuestionEvaluation> findByQuestionSubmissionSubmissionId(UUID submissionId);

    @Modifying
    @Query(value = """
        DELETE FROM question_evaluations qe
        USING question_submissions qs, submissions s
        WHERE qe.question_submission_id = qs.id
        AND qs.submission_id = s.id
        AND s.exam_id = :examId
        """, nativeQuery = true)
    int deleteByExamId(@Param("examId") UUID examId);
}
