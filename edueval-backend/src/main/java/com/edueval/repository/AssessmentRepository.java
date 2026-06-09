package com.edueval.repository;

import com.edueval.entity.Assessment;
import com.edueval.entity.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AssessmentRepository extends JpaRepository<Assessment, UUID> {
    List<Assessment> findByClassroomOrderByCreatedAtDesc(Classroom classroom);
    List<Assessment> findByClassroomId(UUID classroomId);
}
