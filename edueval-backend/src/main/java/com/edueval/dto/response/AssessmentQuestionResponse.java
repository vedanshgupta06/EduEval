package com.edueval.dto.response;

import java.util.List;
import java.util.UUID;

public record AssessmentQuestionResponse(
        UUID id,
        Integer questionNo,
        String questionText,
        String questionType,
        Integer marks,
        List<String> options,
        // correctAnswers is NEVER sent to students — only to teachers
        List<Integer> correctAnswers,
        String scoringMode
) {}