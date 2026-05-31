package com.edueval.dto.request;

import com.edueval.enums.SubmissionStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateSubmissionStatusRequest(

        @NotNull(message = "Status is required")
        SubmissionStatus status

) {}
