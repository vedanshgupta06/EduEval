package com.edueval.repository;
 
import com.edueval.entity.QuestionSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
 
import java.util.List;
import java.util.Optional;
import java.util.UUID;
 
@Repository
public interface QuestionSubmissionRepository extends JpaRepository<QuestionSubmission, UUID> {
 
    List<QuestionSubmission> findBySubmissionId(UUID submissionId);
 
    Optional<QuestionSubmission> findBySubmissionIdAndQuestionId(UUID submissionId, UUID questionId);
 
    List<QuestionSubmission> findBySubmissionIdAndStatus(UUID submissionId, String status);

    @Modifying
    @Query(value = """
        DELETE FROM question_submissions qs
        USING submissions s
        WHERE qs.submission_id = s.id
        AND s.exam_id = :examId
        """, nativeQuery = true)
    int deleteByExamId(@Param("examId") UUID examId);
}
 
