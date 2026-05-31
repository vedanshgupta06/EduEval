package com.edueval.repository;

import com.edueval.entity.Classroom;
import com.edueval.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ClassroomRepository extends JpaRepository<Classroom, UUID> {
    Optional<Classroom> findByClassCode(String classCode);
    List<Classroom> findByTeacherAndArchivedFalse(User teacher);
}