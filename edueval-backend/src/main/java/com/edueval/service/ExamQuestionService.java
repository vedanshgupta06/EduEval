package com.edueval.service;

import com.edueval.dto.request.QuestionRequest;
import com.edueval.dto.request.UpdateExamQuestionRequest;
import com.edueval.dto.response.QuestionResponse;
import com.edueval.entity.Exam;
import com.edueval.entity.ExamQuestion;
import com.edueval.entity.User;
import com.edueval.exception.ResourceNotFoundException;
import com.edueval.exception.UnauthorizedActionException;
import com.edueval.repository.ExamQuestionRepository;
import com.edueval.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class ExamQuestionService {

    private final ExamQuestionRepository examQuestionRepository;
    private final UserRepository userRepository;

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

    @Transactional
    public QuestionResponse updateQuestion(UUID questionId, UpdateExamQuestionRequest request) {
        ExamQuestion question = getQuestion(questionId);
        requireClassroomOwnership(question.getExam());

        question.setQuestionText(request.questionText());
        question.setMarks(request.marks());
        question.setModelAnswerText(request.modelAnswerText());

        int totalMarks = examQuestionRepository.findByExamIdOrderByQuestionNoAsc(question.getExam().getId())
                .stream()
                .mapToInt(q -> q.getId().equals(question.getId()) ? request.marks() : q.getMarks())
                .sum();
        question.getExam().setTotalMarks(totalMarks);

        return toTeacherResponse(examQuestionRepository.save(question));
    }

    /** Map entity → lightweight DTO (no model answer exposed to students). */
    public QuestionResponse toResponse(ExamQuestion q) {
        QuestionResponse r = new QuestionResponse();
        r.setId(q.getId());
        r.setQuestionNo(q.getQuestionNo());
        r.setQuestionText(q.getQuestionText());
        r.setMarks(q.getMarks());
        r.setUpdatedAt(q.getUpdatedAt());
        return r;
    }

    public QuestionResponse toTeacherResponse(ExamQuestion q) {
        QuestionResponse r = toResponse(q);
        r.setModelAnswerText(q.getModelAnswerText());
        return r;
    }

    private void requireClassroomOwnership(Exam exam) {
        User user = currentUser();
        if (!exam.getClassroom().getTeacher().getId().equals(user.getId())) {
            throw new UnauthorizedActionException("You do not own this classroom");
        }
    }

    private User currentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
    }
}
