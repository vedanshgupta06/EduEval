package com.edueval.repository;

import com.edueval.entity.Classroom;
import com.edueval.entity.ClassroomMember;
import com.edueval.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ClassroomMemberRepository extends JpaRepository<ClassroomMember, Long> {

    boolean existsByClassroomAndStudent(Classroom classroom, User student);

    Optional<ClassroomMember> findByClassroomAndStudent(Classroom classroom, User student);

    // All classrooms a student has joined
    List<ClassroomMember> findByStudent(User student);

    // All students in a classroom
    List<ClassroomMember> findByClassroom(Classroom classroom);

    // Count of students in a classroom
    @Query("SELECT COUNT(cm) FROM ClassroomMember cm WHERE cm.classroom = :classroom")
    long countByClassroom(Classroom classroom);
}