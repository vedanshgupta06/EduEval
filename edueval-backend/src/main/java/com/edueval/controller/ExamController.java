package com.edueval.controller;

import com.edueval.dto.request.CreateExamRequest;
import com.edueval.dto.request.UpdateExamRequest;
import com.edueval.dto.response.ExamResponse;
import com.edueval.service.ExamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ExamController {

    private final ExamService examService;

    // POST /api/teacher/classrooms/{id}/exams
    @PostMapping("/api/teacher/classrooms/{classroomId}/exams")
    public ResponseEntity<ExamResponse> createExam(
            @PathVariable UUID classroomId,
            @Valid @RequestBody CreateExamRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(examService.createExam(classroomId, request));
    }

    // GET /api/classrooms/{id}/exams
    @GetMapping("/api/classrooms/{classroomId}/exams")
    public ResponseEntity<List<ExamResponse>> getExamsForClassroom(
            @PathVariable UUID classroomId) {
        return ResponseEntity.ok(examService.getExamsForClassroom(classroomId));
    }

    // GET /api/exams/{id}
    @GetMapping("/api/exams/{id}")
    public ResponseEntity<ExamResponse> getExamById(@PathVariable UUID id) {
        return ResponseEntity.ok(examService.getExamById(id));
    }

    // GET /api/teacher/exams/{id}
    @GetMapping("/api/teacher/exams/{id}")
    public ResponseEntity<ExamResponse> getTeacherExamById(@PathVariable UUID id) {
        return ResponseEntity.ok(examService.getTeacherExamById(id));
    }

    // PUT /api/teacher/exams/{id}
    @PutMapping("/api/teacher/exams/{id}")
    public ResponseEntity<ExamResponse> updateExam(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateExamRequest request) {
        return ResponseEntity.ok(examService.updateExam(id, request));
    }

    // DELETE /api/teacher/exams/{id}
    @DeleteMapping("/api/teacher/exams/{id}")
    public ResponseEntity<Void> deleteExam(@PathVariable UUID id) {
        examService.deleteExam(id);
        return ResponseEntity.noContent().build();
    }
}
