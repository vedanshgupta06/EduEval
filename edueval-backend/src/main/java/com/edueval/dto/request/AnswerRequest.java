package com.edueval.dto.request;

import java.util.UUID;

public record AnswerRequest(
        UUID questionId,
        // MCQ/MULTI_SELECT: JSON array string like "[0]" or "[0,2]"
        // DESCRIPTIVE:      plain text
        String answerValue
) {}
