package com.edueval.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record SubmitAssessmentRequest(

        @NotNull
        List<AnswerRequest> answers

) {}