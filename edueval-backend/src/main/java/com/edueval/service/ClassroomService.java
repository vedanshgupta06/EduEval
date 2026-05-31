package com.edueval.service;

import com.edueval.dto.request.CreateClassroomRequest;
import com.edueval.dto.request.JoinClassroomRequest;
import com.edueval.dto.response.ClassroomResponse;
import com.edueval.entity.Classroom;
import com.edueval.entity.ClassroomMember;
import com.edueval.entity.User;
import com.edueval.exception.ResourceNotFoundException;
import com.edueval.exception.UnauthorizedActionException;
import com.edueval.repository.ClassroomMemberRepository;
import com.edueval.repository.ClassroomRepository;
import com.edueval.repository.ExamRepository;
import com.edueval.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final ClassroomMemberRepository classroomMemberRepository;
    private final ExamRepository examRepository;
    private final UserRepository userRepository;

    private static final String CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    // ── Teacher ──────────────────────────────────────────────────────────────

    @Transactional
    public ClassroomResponse createClassroom(CreateClassroomRequest request) {
        User teacher = currentUser();

        String code;
        do {
            code = generateCode();
        } while (classroomRepository.findByClassCode(code).isPresent());

        Classroom classroom = Classroom.builder()
                .className(request.className())
                .classCode(code)
                .teacher(teacher)
                .archived(false)
                .build();

        return toResponse(classroomRepository.save(classroom));
    }

    @Transactional(readOnly = true)
    public List<ClassroomResponse> getTeacherClassrooms() {
        User teacher = currentUser();
        return classroomRepository.findByTeacherAndArchivedFalse(teacher)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public void archiveClassroom(UUID id) {
        Classroom classroom = findById(id);
        requireTeacherOwnership(classroom);
        classroom.setArchived(true);
        classroomRepository.save(classroom);
    }

    // ── Student ──────────────────────────────────────────────────────────────

    @Transactional
    public ClassroomResponse joinClassroom(JoinClassroomRequest request) {
        User student = currentUser();

        Classroom classroom = classroomRepository.findByClassCode(request.classCode())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No classroom found with code: " + request.classCode()));

        if (classroom.isArchived()) {
            throw new UnauthorizedActionException("This classroom has been archived");
        }
        if (classroomMemberRepository.existsByClassroomAndStudent(classroom, student)) {
            throw new IllegalArgumentException("You have already joined this classroom");
        }

        ClassroomMember membership = ClassroomMember.builder()
                .classroom(classroom)
                .student(student)
                .build();
        classroomMemberRepository.save(membership);

        return toResponse(classroom);
    }

    @Transactional(readOnly = true)
    public List<ClassroomResponse> getStudentClassrooms() {
        User student = currentUser();
        return classroomMemberRepository.findByStudent(student)
                .stream()
                .map(m -> toResponse(m.getClassroom()))
                .collect(Collectors.toList());
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ClassroomResponse getClassroomById(UUID id) {
        return toResponse(findById(id));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Classroom findById(UUID id) {
        return classroomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Classroom not found: " + id));
    }

    private void requireTeacherOwnership(Classroom classroom) {
        User user = currentUser();
        if (!classroom.getTeacher().getId().equals(user.getId())) {
            throw new UnauthorizedActionException("You do not own this classroom");
        }
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder(8);
        for (int i = 0; i < 8; i++) sb.append(CHARS.charAt(RANDOM.nextInt(CHARS.length())));
        return sb.toString();
    }

    private ClassroomResponse toResponse(Classroom c) {
        long studentCount = classroomMemberRepository.countByClassroom(c);
        long examCount    = examRepository.findByClassroom(c).size();
        return new ClassroomResponse(
                c.getId(),
                c.getClassName(),
                c.getClassCode(),
                c.getTeacher().getName(),
                studentCount,
                examCount,
                c.isArchived(),
                c.getCreatedAt()
        );
    }
}
