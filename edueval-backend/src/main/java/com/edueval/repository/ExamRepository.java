package com.edueval.repository;

import com.edueval.entity.Classroom;
import com.edueval.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExamRepository extends JpaRepository<Exam, UUID> {
    List<Exam> findByClassroom(Classroom classroom);
    List<Exam> findByClassroomOrderByDeadlineAsc(Classroom classroom);
}