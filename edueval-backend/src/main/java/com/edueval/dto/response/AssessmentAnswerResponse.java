package com.edueval.dto.response;

import java.util.UUID;

public record AssessmentAnswerResponse(
        UUID id,
        UUID questionId,
        Integer questionNo,
        String questionText,
        String questionType,
        Integer maxMarks,
        String answerValue,
        Double marksObtained,
        Double teacherMarks,
        String teacherComment,
        Double finalMarks,
        String aiFeedbackJson,
        Double aiConfidence
) {}