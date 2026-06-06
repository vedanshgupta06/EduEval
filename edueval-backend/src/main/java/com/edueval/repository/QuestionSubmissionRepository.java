package com.edueval.repository;
 
import com.edueval.entity.QuestionSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
 
import java.util.List;
import java.util.Optional;
import java.util.UUID;
 
@Repository
public interface QuestionSubmissionRepository extends JpaRepository<QuestionSubmission, UUID> {
 
    List<QuestionSubmission> findBySubmissionId(UUID submissionId);
 
    Optional<QuestionSubmission> findBySubmissionIdAndQuestionId(UUID submissionId, UUID questionId);
 
    List<QuestionSubmission> findBySubmissionIdAndStatus(UUID submissionId, String status);
}
 