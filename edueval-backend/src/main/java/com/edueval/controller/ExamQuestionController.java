package com.edueval.controller;

import com.edueval.dto.request.UpdateExamQuestionRequest;
import com.edueval.dto.response.QuestionResponse;
import com.edueval.service.ExamQuestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ExamQuestionController {

    private final ExamQuestionService examQuestionService;

    /**
     * GET /api/exams/{examId}/questions
     * Returns questions for any exam. Accessible by teacher and student.
     * Model answers are NOT included in the response DTO.
     */
    @GetMapping("/exams/{examId}/questions")
    public ResponseEntity<List<QuestionResponse>> getQuestions(@PathVariable UUID examId) {
        List<QuestionResponse> result = examQuestionService
                .getQuestionsForExam(examId)
                .stream()
                .map(examQuestionService::toResponse)
                .toList();
        return ResponseEntity.ok(result);
    }

    @PutMapping("/teacher/exam-questions/{questionId}")
    public ResponseEntity<QuestionResponse> updateQuestion(
            @PathVariable UUID questionId,
            @Valid @RequestBody UpdateExamQuestionRequest request) {
        return ResponseEntity.ok(examQuestionService.updateQuestion(questionId, request));
    }
}
