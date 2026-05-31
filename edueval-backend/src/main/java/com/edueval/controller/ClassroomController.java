package com.edueval.controller;

import com.edueval.dto.request.CreateClassroomRequest;
import com.edueval.dto.request.JoinClassroomRequest;
import com.edueval.dto.response.ClassroomResponse;
import com.edueval.service.ClassroomService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ClassroomController {

    private final ClassroomService classroomService;

    // POST /api/teacher/classrooms
    @PostMapping("/api/teacher/classrooms")
    public ResponseEntity<ClassroomResponse> createClassroom(
            @Valid @RequestBody CreateClassroomRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(classroomService.createClassroom(request));
    }

    // GET /api/teacher/classrooms
    @GetMapping("/api/teacher/classrooms")
    public ResponseEntity<List<ClassroomResponse>> getTeacherClassrooms() {
        return ResponseEntity.ok(classroomService.getTeacherClassrooms());
    }

    // DELETE /api/teacher/classrooms/{id}  → archives (soft delete)
    @DeleteMapping("/api/teacher/classrooms/{id}")
    public ResponseEntity<Void> archiveClassroom(@PathVariable UUID id) {
        classroomService.archiveClassroom(id);
        return ResponseEntity.noContent().build();
    }

    // POST /api/student/classrooms/join
    @PostMapping("/api/student/classrooms/join")
    public ResponseEntity<ClassroomResponse> joinClassroom(
            @Valid @RequestBody JoinClassroomRequest request) {
        return ResponseEntity.ok(classroomService.joinClassroom(request));
    }

    // GET /api/student/classrooms
    @GetMapping("/api/student/classrooms")
    public ResponseEntity<List<ClassroomResponse>> getStudentClassrooms() {
        return ResponseEntity.ok(classroomService.getStudentClassrooms());
    }

    // GET /api/classrooms/{id}
    @GetMapping("/api/classrooms/{id}")
    public ResponseEntity<ClassroomResponse> getClassroomById(@PathVariable UUID id) {
        return ResponseEntity.ok(classroomService.getClassroomById(id));
    }
}
