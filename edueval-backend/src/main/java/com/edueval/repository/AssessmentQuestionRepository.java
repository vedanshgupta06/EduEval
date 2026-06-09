package com.edueval.repository;

import com.edueval.entity.AssessmentQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AssessmentQuestionRepository extends JpaRepository<AssessmentQuestion, UUID> {
    List<AssessmentQuestion> findByAssessmentIdOrderByQuestionNoAsc(UUID assessmentId);
    void deleteByAssessmentId(UUID assessmentId);
}
