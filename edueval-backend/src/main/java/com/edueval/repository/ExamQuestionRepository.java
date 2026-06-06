package com.edueval.repository;
 
import com.edueval.entity.ExamQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
 
import java.util.List;
import java.util.UUID;
 
@Repository
public interface ExamQuestionRepository extends JpaRepository<ExamQuestion, UUID> {
    List<ExamQuestion> findByExamIdOrderByQuestionNoAsc(UUID examId);
    void deleteByExamId(UUID examId);
}