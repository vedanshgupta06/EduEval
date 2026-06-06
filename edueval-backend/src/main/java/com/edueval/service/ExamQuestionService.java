package com.edueval.service;

import com.edueval.dto.request.QuestionRequest;
import com.edueval.dto.response.QuestionResponse;
import com.edueval.entity.Exam;
import com.edueval.entity.ExamQuestion;
import com.edueval.repository.ExamQuestionRepository;
import com.edueval.repository.ExamRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class ExamQuestionService {

    private final ExamQuestionRepository examQuestionRepository;
    private final ExamRepository examRepository;

    /** Called by ExamService when creating a multi-question exam. */
    @Transactional
    public void saveQuestionsForExam(Exam exam, List<QuestionRequest> requests) {
        examQuestionRepository.deleteByExamId(exam.getId()); // idempotent replace

        List<ExamQuestion> questions = IntStream.range(0, requests.size())
                .mapToObj(i -> {
                    QuestionRequest req = requests.get(i);
                    return ExamQuestion.builder()
                            .exam(exam)
                            .questionNo(i + 1)
                            .questionText(req.getQuestionText())
                            .marks(req.getMarks())
                            .modelAnswerText(req.getModelAnswerText())
                            .build();
                })
                .toList();

        examQuestionRepository.saveAll(questions);
    }

    public List<ExamQuestion> getQuestionsForExam(UUID examId) {
        return examQuestionRepository.findByExamIdOrderByQuestionNoAsc(examId);
    }

    public ExamQuestion getQuestion(UUID questionId) {
        return examQuestionRepository.findById(questionId)
                .orElseThrow(() -> new EntityNotFoundException("Question not found: " + questionId));
    }

    /** Map entity → lightweight DTO (no model answer exposed to students). */
    public QuestionResponse toResponse(ExamQuestion q) {
        QuestionResponse r = new QuestionResponse();
        r.setId(q.getId());
        r.setQuestionNo(q.getQuestionNo());
        r.setQuestionText(q.getQuestionText());
        r.setMarks(q.getMarks());
        return r;
    }
}